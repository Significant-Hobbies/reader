/**
 * One-off script: assign all Firestore documents that have no userId
 * (or a mismatched userId) to the given email's Firebase UID.
 *
 * Usage:  npx tsx scripts/link-docs.ts
 */

import * as admin from 'firebase-admin';
import { db } from '../src/lib/firebase-admin';
import { ARTICLES_COLLECTION } from '../src/lib/articles-service';

const TARGET_EMAIL = 'sarthakagrawal927@gmail.com';

async function main() {
  // Resolve UID from email
  const userRecord = await admin.auth().getUserByEmail(TARGET_EMAIL);
  const uid = userRecord.uid;
  console.log(`Resolved ${TARGET_EMAIL} → uid: ${uid}`);

  let updatedArticles = 0;
  let updatedProjects = 0;

  // --- annotations (articles) ---
  const articlesSnap = await db.collection(ARTICLES_COLLECTION).get();
  for (const doc of articlesSnap.docs) {
    const data = doc.data();
    if (!data.userId) {
      await doc.ref.update({ userId: uid });
      updatedArticles++;
      console.log(`  annotations/${doc.id} — claimed (was unowned)`);
    }
  }

  // --- projects ---
  const projectsSnap = await db.collection('projects').get();
  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    if (!data.userId) {
      await doc.ref.update({ userId: uid });
      updatedProjects++;
      console.log(`  projects/${doc.id} — claimed (was unowned)`);
    }
  }

  console.log(`\nDone. Updated ${updatedArticles} articles, ${updatedProjects} projects.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
