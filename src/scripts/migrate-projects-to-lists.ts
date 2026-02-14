#!/usr/bin/env tsx

/**
 * Migration Script: Projects to Lists
 *
 * This script migrates the legacy project-based system to the new list-based system.
 *
 * Migration Steps:
 * 1. Get all unique userIds from the projects collection
 * 2. For each user:
 *    - Create default lists (Favourites and Read Later) using ensureDefaultLists
 *    - Convert existing projects to custom lists (excluding "Default" project)
 *    - Create a mapping of projectId -> listId
 * 3. Update all articles to use listIds based on their projectId
 * 4. Use Firestore batching (max 500 operations per batch)
 *
 * Safety:
 * - Keep the projectId field for rollback safety
 * - Populate the new listIds field
 * - Dry-run mode available for testing
 *
 * Usage:
 *   npx tsx src/scripts/migrate-projects-to-lists.ts
 *   npx tsx src/scripts/migrate-projects-to-lists.ts --dry-run
 */

import { db } from '../lib/firebase-admin';
import { ensureDefaultLists } from '../lib/lists-service';
import { Timestamp } from 'firebase-admin/firestore';

interface MigrationStats {
  usersProcessed: number;
  projectsConverted: number;
  defaultProjectsSkipped: number;
  articlesUpdated: number;
  batchesCommitted: number;
  errors: Array<{ userId: string; error: string }>;
}

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Get all unique user IDs from the projects collection
 */
async function getAllUserIds(): Promise<string[]> {
  console.log('📋 Fetching all unique user IDs from projects collection...');

  const projectsSnapshot = await db.collection('projects').get();
  const userIds = new Set<string>();

  projectsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.userId) {
      userIds.add(data.userId);
    }
  });

  console.log(`✅ Found ${userIds.size} unique users with projects`);
  return Array.from(userIds);
}

/**
 * Check if a project is a default project
 * Default projects have ID format: {userId}_default
 */
function isDefaultProject(projectId: string, userId: string): boolean {
  return projectId === `${userId}_default`;
}

/**
 * Convert a project to a custom list
 */
async function convertProjectToList(
  projectId: string,
  projectName: string,
  userId: string
): Promise<string> {
  const now = Timestamp.now();

  // Get the project's createdAt timestamp for consistency
  const projectDoc = await db.collection('projects').doc(projectId).get();
  const projectData = projectDoc.data();
  const createdAt = projectData?.createdAt || now;

  // Create a custom list with the same name as the project
  const listRef = await db.collection('lists').add({
    name: projectName,
    userId,
    color: 'blue', // Default color for migrated projects
    icon: 'dot',
    isDefault: false,
    createdAt,
    updatedAt: now,
  });

  return listRef.id;
}

/**
 * Create project ID to list ID mapping for a user
 */
async function createProjectToListMapping(userId: string): Promise<Map<string, string>> {
  console.log(`  📂 Creating project -> list mapping for user: ${userId.substring(0, 8)}...`);

  const mapping = new Map<string, string>();

  // Ensure default lists exist (Favourites and Read Later)
  const defaultLists = await ensureDefaultLists(userId);
  console.log(`  ✅ Default lists ensured: ${defaultLists.map((l) => l.name).join(', ')}`);

  // Get all projects for this user
  const projectsSnapshot = await db.collection('projects').where('userId', '==', userId).get();

  let projectsConverted = 0;
  let defaultProjectsSkipped = 0;

  for (const projectDoc of projectsSnapshot.docs) {
    const projectId = projectDoc.id;
    const projectData = projectDoc.data();
    const projectName = projectData.name || 'Untitled';

    // Skip default projects - they don't need to be converted
    if (isDefaultProject(projectId, userId)) {
      console.log(`  ⏭️  Skipping default project: ${projectId}`);
      defaultProjectsSkipped++;
      continue;
    }

    // Convert project to list
    if (!DRY_RUN) {
      const listId = await convertProjectToList(projectId, projectName, userId);
      mapping.set(projectId, listId);
      console.log(`  ✅ Converted project "${projectName}" -> list ${listId}`);
      projectsConverted++;
    } else {
      console.log(`  [DRY-RUN] Would convert project "${projectName}" to list`);
      projectsConverted++;
    }
  }

  console.log(
    `  📊 Projects converted: ${projectsConverted}, Default projects skipped: ${defaultProjectsSkipped}`
  );

  return mapping;
}

/**
 * Update articles to use listIds based on their projectId
 * Uses Firestore batching for efficiency (max 500 operations per batch)
 */
async function updateArticlesForUser(
  userId: string,
  projectToListMapping: Map<string, string>
): Promise<{ articlesUpdated: number; batchesCommitted: number }> {
  console.log(`  📄 Updating articles for user: ${userId.substring(0, 8)}...`);

  // Get all articles for this user
  const articlesSnapshot = await db.collection('annotations').where('userId', '==', userId).get();

  console.log(`  📊 Found ${articlesSnapshot.size} articles to process`);

  if (articlesSnapshot.empty) {
    return { articlesUpdated: 0, batchesCommitted: 0 };
  }

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;
  let articlesUpdated = 0;

  articlesSnapshot.forEach((articleDoc) => {
    const articleData = articleDoc.data();
    const projectId = articleData.projectId;

    // Skip articles that already have listIds populated
    if (
      articleData.listIds &&
      Array.isArray(articleData.listIds) &&
      articleData.listIds.length > 0
    ) {
      console.log(`  ⏭️  Article ${articleDoc.id} already has listIds, skipping`);
      return;
    }

    // Determine which list(s) this article should belong to
    const listIds: string[] = [];

    if (projectId) {
      // If the article has a projectId, map it to the corresponding listId
      if (isDefaultProject(projectId, userId)) {
        // Default project articles don't get automatically added to any list
        // Users can manually add them to lists later
        console.log(`  📝 Article ${articleDoc.id} is in default project, leaving listIds empty`);
      } else if (projectToListMapping.has(projectId)) {
        // Add to the corresponding custom list
        const listId = projectToListMapping.get(projectId)!;
        listIds.push(listId);
        console.log(`  📝 Article ${articleDoc.id}: projectId ${projectId} -> listId ${listId}`);
      } else {
        console.log(`  ⚠️  Article ${articleDoc.id} has unknown projectId: ${projectId}`);
      }
    }

    // Update the article with listIds (keeping projectId for safety)
    currentBatch.update(articleDoc.ref, {
      listIds,
      updatedAt: Timestamp.now(),
    });

    operationCount++;
    articlesUpdated++;

    // Firestore batch limit is 500 operations
    if (operationCount >= 500) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      operationCount = 0;
    }
  });

  // Add the last batch if it has operations
  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  // Commit all batches
  if (!DRY_RUN) {
    let batchNumber = 1;
    for (const batch of batches) {
      console.log(`  ⚙️  Committing batch ${batchNumber}/${batches.length}...`);
      await batch.commit();
      batchNumber++;
    }
    console.log(`  ✅ Committed ${batches.length} batches, updated ${articlesUpdated} articles`);
  } else {
    console.log(
      `  [DRY-RUN] Would commit ${batches.length} batches, update ${articlesUpdated} articles`
    );
  }

  return {
    articlesUpdated,
    batchesCommitted: batches.length,
  };
}

/**
 * Migrate a single user's projects to lists
 */
async function migrateUser(userId: string, stats: MigrationStats): Promise<void> {
  console.log(`\n👤 Processing user: ${userId.substring(0, 8)}...`);

  try {
    // Step 1: Create project -> list mapping
    const projectToListMapping = await createProjectToListMapping(userId);
    stats.projectsConverted += projectToListMapping.size;

    // Count default projects (they exist but aren't in the mapping)
    const allProjectsSnapshot = await db.collection('projects').where('userId', '==', userId).get();
    const totalProjects = allProjectsSnapshot.size;
    stats.defaultProjectsSkipped += totalProjects - projectToListMapping.size;

    // Step 2: Update articles with listIds
    const { articlesUpdated, batchesCommitted } = await updateArticlesForUser(
      userId,
      projectToListMapping
    );
    stats.articlesUpdated += articlesUpdated;
    stats.batchesCommitted += batchesCommitted;

    stats.usersProcessed++;
    console.log(`✅ Completed migration for user ${userId.substring(0, 8)}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error migrating user ${userId}:`, errorMessage);
    stats.errors.push({ userId, error: errorMessage });
  }
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  console.log('\n🚀 Starting Projects to Lists Migration');
  console.log('==========================================\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY-RUN MODE: No changes will be made to the database\n');
  }

  const stats: MigrationStats = {
    usersProcessed: 0,
    projectsConverted: 0,
    defaultProjectsSkipped: 0,
    articlesUpdated: 0,
    batchesCommitted: 0,
    errors: [],
  };

  try {
    // Get all user IDs
    const userIds = await getAllUserIds();

    if (userIds.length === 0) {
      console.log('ℹ️  No users found with projects. Nothing to migrate.');
      return;
    }

    // Migrate each user
    for (const userId of userIds) {
      await migrateUser(userId, stats);
    }

    // Print final statistics
    console.log('\n==========================================');
    console.log('📊 Migration Statistics');
    console.log('==========================================');
    console.log(`Users processed:           ${stats.usersProcessed}/${userIds.length}`);
    console.log(`Projects converted:        ${stats.projectsConverted}`);
    console.log(`Default projects skipped:  ${stats.defaultProjectsSkipped}`);
    console.log(`Articles updated:          ${stats.articlesUpdated}`);
    console.log(`Batches committed:         ${stats.batchesCommitted}`);
    console.log(`Errors:                    ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(({ userId, error }) => {
        console.log(`  - User ${userId.substring(0, 8)}: ${error}`);
      });
    }

    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY-RUN. No changes were made to the database.');
      console.log('Run without --dry-run to apply the migration.');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify the migration by checking a few user accounts');
      console.log('2. Test the application with the new list-based system');
      console.log('3. Monitor for any issues with article organization');
      console.log('4. Once verified, you can optionally remove the projectId field from articles');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrate()
  .then(() => {
    console.log('\n🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
