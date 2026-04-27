import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { AIChatMessage, ArticleStatus, Note } from '../../types';

// --- User table (shared by better-auth; legacy NextAuth columns kept for existing rows) ---
export const users = sqliteTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').default(''),
  email: text('email').unique(),
  // Stored as 0/1 integer; better-auth reads this as boolean via its own coercion
  emailVerified: integer('emailVerified').default(0),
  image: text('image'),
  // Added for better-auth; existing rows get NULL (no expression default — SQLite limitation)
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }),
});

// --- better-auth tables ---
export const baSessions = sqliteTable('ba_session', {
  id: text('id').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
});

export const baAccounts = sqliteTable('ba_account', {
  id: text('id').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('providerId').notNull(),
  accountId: text('accountId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
});

export const baVerifications = sqliteTable('ba_verification', {
  id: text('id').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
});

// --- Legacy NextAuth tables (kept for reference, not used by better-auth) ---
export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => ({
    compositePk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// --- App tables ---

// JSON columns are stored as text + serialized in the service layer.
// $type<T>() gives us TS-level guarantees without any runtime cost.

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    byline: text('byline'),
    siteName: text('site_name'),
    tags: text('tags').$type<string[]>(),
    listIds: text('list_ids').$type<string[]>(),
    notes: text('notes').$type<Note[]>(),
    aiChat: text('ai_chat').$type<AIChatMessage[]>(),
    summary: text('summary').$type<{ short?: string; medium?: string; long?: string }>(),
    keyPoints: text('key_points').$type<string[]>(),
    status: text('status').$type<ArticleStatus>().default('in_progress'),
    readingTimeMinutes: integer('reading_time_minutes'),
    shareId: text('share_id').unique(),
    isShared: integer('is_shared').default(0),
    type: text('type').notNull().default('article'),
    pdfStorageKey: text('pdf_storage_key'),
    extractedText: text('extracted_text'),
    pdfMetadata: text('pdf_metadata').$type<{
      pageCount?: number;
      fileSize?: number;
      storagePath?: string;
    }>(),
    category: text('category'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userCreatedIdx: index('articles_user_created_idx').on(t.userId, t.createdAt),
    userUrlIdx: index('articles_user_url_idx').on(t.userId, t.url),
    shareIdx: index('articles_share_idx').on(t.shareId),
  })
);

export const boards = sqliteTable(
  'boards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nodes: text('nodes').$type<unknown[]>(),
    edges: text('edges').$type<unknown[]>(),
    shareId: text('share_id').unique(),
    isShared: integer('is_shared').default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('boards_user_idx').on(t.userId),
  })
);

export const lists = sqliteTable(
  'lists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    color: text('color'),
    isDefault: integer('is_default').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userIdx: index('lists_user_idx').on(t.userId),
  })
);

export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    userRevokedIdx: index('api_keys_user_revoked_idx').on(t.userId, t.revokedAt),
  })
);

export type UserRow = typeof users.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type NewArticleRow = typeof articles.$inferInsert;
export type BoardRow = typeof boards.$inferSelect;
export type NewBoardRow = typeof boards.$inferInsert;
export type ListRow = typeof lists.$inferSelect;
export type NewListRow = typeof lists.$inferInsert;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
