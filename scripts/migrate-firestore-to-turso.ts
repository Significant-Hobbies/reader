/**
 * One-shot Firestore → Turso migration script.
 *
 * Usage:
 *   pnpm migrate:firestore            # dry-run (default, safe)
 *   pnpm migrate:firestore --apply    # actually write to Turso
 *
 * What it does (in order):
 *   1. users  — Firebase Auth → Turso `user` table (one row for the target uid)
 *   2. lists  — Firestore `lists` → Turso `lists`
 *   3. articles — Firestore `annotations` → Turso `articles`
 *   4. boards — Firestore `boards` → Turso `boards`
 *
 * Idempotency: every insert uses INSERT ... ON CONFLICT(id) DO UPDATE (upsert).
 * A re-run of --apply is safe; it refreshes column values.
 *
 * Scope: the user has ~5 articles / 1 board / 2 lists / 1 user. This script is
 * built for that scale; it is NOT streaming or batched. If data grows, rewrite.
 */

import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import admin from 'firebase-admin';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';

// Relative imports (scripts run outside Next.js, so no `@/` alias).
import * as schema from '../src/lib/db/schema';

// --- Env loading ---
// tsx doesn't auto-load .env.local; dotenv/config reads .env only. Load .env.local explicitly.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
loadEnv({ path: resolve(repoRoot, '.env.local') });

// --- CLI flags ---
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY_RUN = !APPLY;

// Single-user migration target (per plan).
const TARGET_USER_ID = 'zxhdLO9NLwcTgRJNLNNFHTiAEnH3';

// --- Firebase Admin init (from service account JSON on disk) ---
const serviceAccountPath = resolve(repoRoot, 'firebase-service-account.json');
let serviceAccountRaw: string;
try {
  serviceAccountRaw = readFileSync(serviceAccountPath, 'utf-8');
} catch (error) {
  console.error(
    `Could not read ${serviceAccountPath}. Ensure firebase-service-account.json exists in the repo root.`
  );
  throw error;
}
const serviceAccount = JSON.parse(serviceAccountRaw) as admin.ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const firestore = admin.firestore();
const auth = admin.auth();

// --- Turso init (mirrors src/lib/db/client.ts but without the Next-time throw) ---
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
  process.exit(1);
}
const libsql = createClient({ url, authToken });
const db = drizzle(libsql, { schema });

// --- Helpers ---
type Counts = { fetched: number; inserted: number; skipped: number; errored: number };
const newCounts = (): Counts => ({ fetched: 0, inserted: 0, skipped: 0, errored: 0 });

function toMillis(value: unknown): number | null {
  if (value == null) return null;
  // Firestore Timestamp has .toDate(); also accept raw numbers and JS Dates.
  const v = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}

function toJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('  failed to serialize json column:', error);
    return null;
  }
}

function preview(obj: unknown, max = 300): string {
  const s = JSON.stringify(obj, null, 2);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// --- Step 1: users ---
async function migrateUser(counts: Counts): Promise<void> {
  console.log('\n[1/4] Users');
  console.log(`  Fetching Firebase Auth user ${TARGET_USER_ID}`);
  counts.fetched = 1;

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await auth.getUser(TARGET_USER_ID);
  } catch (error) {
    console.error(`  ✗ Failed to fetch user from Firebase Auth:`, error);
    counts.errored = 1;
    return;
  }

  const row = {
    id: userRecord.uid,
    email: userRecord.email ?? null,
    name: userRecord.displayName ?? null,
    image: userRecord.photoURL ?? null,
    emailVerified: null, // Auth.js stores its own verification; leave null on migration.
  };

  console.log(`  Sample row: ${preview(row)}`);
  console.log(`  Writing 1 row to user table`);

  if (DRY_RUN) {
    counts.inserted = 1; // would-be
    return;
  }

  try {
    // Drizzle doesn't have first-class ON CONFLICT DO UPDATE helpers that are
    // portable across dialects; raw SQL is cleanest here for a handful of rows.
    await db.run(sql`
      INSERT INTO user (id, email, name, image, emailVerified)
      VALUES (${row.id}, ${row.email}, ${row.name}, ${row.image}, ${row.emailVerified})
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        image = excluded.image
    `);
    counts.inserted = 1;
  } catch (error) {
    console.error(`  ✗ Insert failed for user ${row.id}:`, error);
    counts.errored = 1;
  }
}

// --- Step 2: lists ---
async function migrateLists(counts: Counts): Promise<void> {
  console.log('\n[2/4] Lists');
  const snap = await firestore.collection('lists').where('userId', '==', TARGET_USER_ID).get();
  counts.fetched = snap.size;
  console.log(`  Fetching ${snap.size} docs from lists`);

  // Also pick up legacy default-list docs whose IDs are {userId}_favourites / {userId}_read-later
  // even if they lack `userId` — grab them explicitly in case they predate the field.
  const legacyIds = [`${TARGET_USER_ID}_favourites`, `${TARGET_USER_ID}_read-later`];
  const legacyDocs = await Promise.all(
    legacyIds.map((id) => firestore.collection('lists').doc(id).get())
  );
  const legacyExtras = legacyDocs.filter((d) => d.exists && !snap.docs.some((s) => s.id === d.id));
  if (legacyExtras.length) {
    console.log(
      `  + ${legacyExtras.length} legacy default-list docs picked up by ID (no userId field)`
    );
    counts.fetched += legacyExtras.length;
  }

  const allDocs = [...snap.docs, ...legacyExtras];
  if (!allDocs.length) {
    console.log('  (no lists to migrate)');
    return;
  }

  let samplePrinted = false;

  for (const doc of allDocs) {
    const data = doc.data() ?? {};
    const id = doc.id;
    const isDefault =
      data.isDefault === true || id.endsWith('_favourites') || id.endsWith('_read-later');
    const icon =
      data.icon ??
      (id.endsWith('_favourites') ? 'heart' : id.endsWith('_read-later') ? 'clock' : 'dot');
    const color = data.color ?? (isDefault ? null : 'blue');

    const row = {
      id,
      userId: TARGET_USER_ID,
      name:
        typeof data.name === 'string' && data.name
          ? data.name
          : id.endsWith('_favourites')
            ? 'Favourites'
            : id.endsWith('_read-later')
              ? 'Read Later'
              : 'Untitled',
      icon,
      color,
      isDefault: isDefault ? 1 : 0,
      createdAt: toMillis(data.createdAt) ?? Date.now(),
      updatedAt: toMillis(data.updatedAt) ?? Date.now(),
    };

    if (!samplePrinted) {
      console.log(`  Sample row: ${preview(row)}`);
      samplePrinted = true;
    }

    if (DRY_RUN) {
      counts.inserted++;
      continue;
    }

    try {
      await db.run(sql`
        INSERT INTO lists (id, user_id, name, icon, color, is_default, created_at, updated_at)
        VALUES (${row.id}, ${row.userId}, ${row.name}, ${row.icon}, ${row.color}, ${row.isDefault}, ${row.createdAt}, ${row.updatedAt})
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          icon = excluded.icon,
          color = excluded.color,
          is_default = excluded.is_default,
          updated_at = excluded.updated_at
      `);
      counts.inserted++;
    } catch (error) {
      console.error(`  ✗ Insert failed for list ${id}:`, error);
      counts.errored++;
    }
  }

  console.log(`  Writing ${counts.inserted} rows to lists`);
}

// --- Step 3: articles (from `annotations` collection) ---
async function migrateArticles(counts: Counts): Promise<{ pdfCount: number }> {
  console.log('\n[3/4] Articles (annotations)');
  const snap = await firestore
    .collection('annotations')
    .where('userId', '==', TARGET_USER_ID)
    .get();
  counts.fetched = snap.size;
  console.log(`  Fetching ${snap.size} docs from annotations`);

  let samplePrinted = false;
  let pdfCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() ?? {};
    const id = doc.id;

    // projectId is dropped in Turso schema (see plan §2.5) — don't carry it.
    const pdfMetadata = data.pdfMetadata ?? null;
    const pdfStorageKey =
      pdfMetadata &&
      typeof pdfMetadata === 'object' &&
      (pdfMetadata as Record<string, unknown>).storagePath
        ? String((pdfMetadata as Record<string, unknown>).storagePath)
        : null;
    if (pdfStorageKey) pdfCount++;

    const summary =
      data.summary != null
        ? data.summary
        : typeof data.aiSummary === 'string'
          ? { medium: data.aiSummary }
          : null;

    const row = {
      id,
      userId: data.userId ?? TARGET_USER_ID,
      url: typeof data.url === 'string' ? data.url : '',
      title: typeof data.title === 'string' && data.title ? data.title : (data.url ?? 'Untitled'),
      content: typeof data.content === 'string' ? data.content : null,
      byline: typeof data.byline === 'string' ? data.byline : null,
      siteName: typeof data.siteName === 'string' ? data.siteName : null,
      tags: toJson(Array.isArray(data.tags) ? data.tags : []),
      listIds: toJson(Array.isArray(data.listIds) ? data.listIds : []),
      notes: toJson(Array.isArray(data.notes) ? data.notes : []),
      aiChat: toJson(Array.isArray(data.aiChat) ? data.aiChat : []),
      summary: toJson(summary),
      keyPoints: toJson(Array.isArray(data.keyPoints) ? data.keyPoints : null),
      status: data.status === 'read' ? 'read' : 'in_progress',
      readingTimeMinutes:
        typeof data.readingTimeMinutes === 'number' ? data.readingTimeMinutes : null,
      shareId: typeof data.shareId === 'string' ? data.shareId : null,
      isShared: data.isShared ? 1 : 0,
      type: data.type === 'pdf' ? 'pdf' : 'article',
      pdfStorageKey, // preserve GCS path as-is; Phase 4 / cutover decides fate.
      extractedText: typeof data.extractedText === 'string' ? data.extractedText : null,
      pdfMetadata: toJson(pdfMetadata),
      category: typeof data.category === 'string' ? data.category : null,
      createdAt: toMillis(data.createdAt) ?? Date.now(),
      updatedAt: toMillis(data.updatedAt) ?? Date.now(),
    };

    if (!row.url) {
      console.warn(`  ! Article ${id} has no url — skipping`);
      counts.skipped++;
      continue;
    }

    if (!samplePrinted) {
      console.log(
        `  Sample row: ${preview({ ...row, content: row.content ? `<${row.content.length} chars>` : null })}`
      );
      samplePrinted = true;
    }

    if (DRY_RUN) {
      counts.inserted++;
      continue;
    }

    try {
      await db.run(sql`
        INSERT INTO articles (
          id, user_id, url, title, content, byline, site_name,
          tags, list_ids, notes, ai_chat, summary, key_points,
          status, reading_time_minutes, share_id, is_shared, type,
          pdf_storage_key, extracted_text, pdf_metadata, category,
          created_at, updated_at
        ) VALUES (
          ${row.id}, ${row.userId}, ${row.url}, ${row.title}, ${row.content}, ${row.byline}, ${row.siteName},
          ${row.tags}, ${row.listIds}, ${row.notes}, ${row.aiChat}, ${row.summary}, ${row.keyPoints},
          ${row.status}, ${row.readingTimeMinutes}, ${row.shareId}, ${row.isShared}, ${row.type},
          ${row.pdfStorageKey}, ${row.extractedText}, ${row.pdfMetadata}, ${row.category},
          ${row.createdAt}, ${row.updatedAt}
        )
        ON CONFLICT(id) DO UPDATE SET
          url = excluded.url,
          title = excluded.title,
          content = excluded.content,
          byline = excluded.byline,
          site_name = excluded.site_name,
          tags = excluded.tags,
          list_ids = excluded.list_ids,
          notes = excluded.notes,
          ai_chat = excluded.ai_chat,
          summary = excluded.summary,
          key_points = excluded.key_points,
          status = excluded.status,
          reading_time_minutes = excluded.reading_time_minutes,
          share_id = excluded.share_id,
          is_shared = excluded.is_shared,
          type = excluded.type,
          pdf_storage_key = excluded.pdf_storage_key,
          extracted_text = excluded.extracted_text,
          pdf_metadata = excluded.pdf_metadata,
          category = excluded.category,
          updated_at = excluded.updated_at
      `);
      counts.inserted++;
    } catch (error) {
      console.error(`  ✗ Insert failed for article ${id}:`, error);
      counts.errored++;
    }
  }

  console.log(`  Writing ${counts.inserted} rows to articles`);
  return { pdfCount };
}

// --- Step 4: boards ---
async function migrateBoards(counts: Counts): Promise<void> {
  console.log('\n[4/4] Boards');
  const snap = await firestore.collection('boards').where('userId', '==', TARGET_USER_ID).get();
  counts.fetched = snap.size;
  console.log(`  Fetching ${snap.size} docs from boards`);

  let samplePrinted = false;

  for (const doc of snap.docs) {
    const data = doc.data() ?? {};
    const id = doc.id;

    const row = {
      id,
      userId: data.userId ?? TARGET_USER_ID,
      name: typeof data.name === 'string' && data.name ? data.name : 'Untitled Board',
      nodes: toJson(Array.isArray(data.nodes) ? data.nodes : []),
      edges: toJson(Array.isArray(data.edges) ? data.edges : []),
      shareId: typeof data.shareId === 'string' ? data.shareId : null,
      isShared: data.isShared ? 1 : 0,
      createdAt: toMillis(data.createdAt) ?? Date.now(),
      updatedAt: toMillis(data.updatedAt) ?? Date.now(),
    };

    if (!samplePrinted) {
      console.log(
        `  Sample row: ${preview({
          ...row,
          nodes: row.nodes ? `<${(JSON.parse(row.nodes) as unknown[]).length} nodes>` : null,
          edges: row.edges ? `<${(JSON.parse(row.edges) as unknown[]).length} edges>` : null,
        })}`
      );
      samplePrinted = true;
    }

    if (DRY_RUN) {
      counts.inserted++;
      continue;
    }

    try {
      await db.run(sql`
        INSERT INTO boards (
          id, user_id, name, nodes, edges, share_id, is_shared, created_at, updated_at
        ) VALUES (
          ${row.id}, ${row.userId}, ${row.name}, ${row.nodes}, ${row.edges},
          ${row.shareId}, ${row.isShared}, ${row.createdAt}, ${row.updatedAt}
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          nodes = excluded.nodes,
          edges = excluded.edges,
          share_id = excluded.share_id,
          is_shared = excluded.is_shared,
          updated_at = excluded.updated_at
      `);
      counts.inserted++;
    } catch (error) {
      console.error(`  ✗ Insert failed for board ${id}:`, error);
      counts.errored++;
    }
  }

  console.log(`  Writing ${counts.inserted} rows to boards`);
}

// --- Main ---
async function main(): Promise<void> {
  console.log('─'.repeat(60));
  console.log(`Firestore → Turso migration (${DRY_RUN ? 'DRY-RUN' : 'APPLY'})`);
  console.log(`Target user: ${TARGET_USER_ID}`);
  console.log(`Turso URL: ${url}`);
  console.log('─'.repeat(60));

  const totals = {
    users: newCounts(),
    lists: newCounts(),
    articles: newCounts(),
    boards: newCounts(),
  };

  await migrateUser(totals.users);
  await migrateLists(totals.lists);
  const { pdfCount } = await migrateArticles(totals.articles);
  await migrateBoards(totals.boards);

  console.log('\n' + '─'.repeat(60));
  console.log(`Summary (${DRY_RUN ? 'DRY-RUN — nothing written' : 'APPLIED'})`);
  console.log('─'.repeat(60));
  for (const [table, c] of Object.entries(totals)) {
    console.log(
      `  ${table.padEnd(10)} fetched=${c.fetched} inserted=${c.inserted} skipped=${c.skipped} errored=${c.errored}`
    );
  }
  console.log(
    `\n  PDFs: ${pdfCount} article(s) carry a GCS storagePath.` +
      ` pdfStorageKey is preserved verbatim; the actual PDF binary is NOT migrated` +
      ` (Phase 4 owns storage swap — expect broken PDF links for pre-migration docs` +
      ` until re-upload).`
  );

  if (DRY_RUN) {
    console.log('\n  Re-run with --apply to write.\n');
  }

  // libsql client keeps the event loop alive; close explicitly.
  libsql.close();
}

main().catch((error) => {
  console.error('\nMigration failed:', error);
  libsql.close();
  process.exit(1);
});
