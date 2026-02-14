import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { List } from '../types';
import { sanitizePlainText } from './articles-service';

// Default list IDs (format: {userId}_favourites, {userId}_read-later)
export function favouritesListId(userId: string): string {
  return `${userId}_favourites`;
}

export function readLaterListId(userId: string): string {
  return `${userId}_read-later`;
}

/**
 * Ensure default lists exist for a user (Favourites and Read Later)
 * Creates them if they don't exist, returns them if they do
 */
export async function ensureDefaultLists(userId: string): Promise<List[]> {
  const favouritesId = favouritesListId(userId);
  const readLaterId = readLaterListId(userId);

  // Create or get Favourites list
  const favouritesRef = db.collection('lists').doc(favouritesId);
  const favouritesSnap = await favouritesRef.get();

  if (!favouritesSnap.exists) {
    const now = Timestamp.now();
    await favouritesRef.set({
      name: 'Favourites',
      userId,
      icon: 'heart',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create or get Read Later list
  const readLaterRef = db.collection('lists').doc(readLaterId);
  const readLaterSnap = await readLaterRef.get();

  if (!readLaterSnap.exists) {
    const now = Timestamp.now();
    await readLaterRef.set({
      name: 'Read Later',
      userId,
      icon: 'clock',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Fetch fresh data
  const favouritesData = (await favouritesRef.get()).data()!;
  const readLaterData = (await readLaterRef.get()).data()!;

  const favourites: List = {
    id: favouritesId,
    name: favouritesData.name || 'Favourites',
    userId,
    icon: 'heart',
    isDefault: true,
    createdAt: favouritesData.createdAt?.toDate().toISOString(),
    updatedAt: favouritesData.updatedAt?.toDate().toISOString(),
  };

  const readLater: List = {
    id: readLaterId,
    name: readLaterData.name || 'Read Later',
    userId,
    icon: 'clock',
    isDefault: true,
    createdAt: readLaterData.createdAt?.toDate().toISOString(),
    updatedAt: readLaterData.updatedAt?.toDate().toISOString(),
  };

  return [favourites, readLater];
}

/**
 * Fetch all lists for a user (default lists first, then custom lists ordered by creation date)
 */
export async function fetchLists(userId: string): Promise<List[]> {
  // Ensure default lists exist
  const defaultLists = await ensureDefaultLists(userId);

  // Fetch custom lists (non-default)
  const snapshot = await db
    .collection('lists')
    .where('userId', '==', userId)
    .where('isDefault', '==', false)
    .orderBy('createdAt', 'desc')
    .get();

  const customLists: List[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      userId: data.userId,
      color: data.color,
      icon: data.icon || 'dot',
      isDefault: false,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    };
  });

  // Return default lists first, then custom lists
  return [...defaultLists, ...customLists];
}

/**
 * Create a new custom list
 */
export async function createList(name: string, userId: string, color?: string): Promise<string> {
  const sanitizedName = sanitizePlainText(name).slice(0, 100);

  if (!sanitizedName) {
    throw new Error('List name is required');
  }

  const now = Timestamp.now();
  const ref = await db.collection('lists').add({
    name: sanitizedName,
    userId,
    color: color || 'blue',
    icon: 'dot',
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

/**
 * Update a custom list's name or color
 * Cannot update default lists
 */
export async function updateList(
  listId: string,
  userId: string,
  updates: { name?: string; color?: string }
): Promise<void> {
  // Fetch and validate ownership
  const doc = await db.collection('lists').doc(listId).get();

  if (!doc.exists) {
    throw new Error('List not found');
  }

  const data = doc.data()!;

  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Prevent editing default lists
  if (data.isDefault) {
    throw new Error('Cannot edit default lists');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (updates.name !== undefined) {
    const sanitizedName = sanitizePlainText(updates.name).slice(0, 100);
    if (!sanitizedName) {
      throw new Error('List name is required');
    }
    updateData.name = sanitizedName;
  }

  if (updates.color !== undefined) {
    updateData.color = updates.color;
  }

  await db.collection('lists').doc(listId).update(updateData);
}

/**
 * Delete a custom list (and remove it from all articles)
 * Cannot delete default lists
 */
export async function deleteList(listId: string, userId: string): Promise<void> {
  // Validate ownership
  const doc = await db.collection('lists').doc(listId).get();

  if (!doc.exists) {
    throw new Error('List not found');
  }

  const data = doc.data()!;

  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Prevent deletion of default lists
  if (data.isDefault) {
    throw new Error('Cannot delete default lists');
  }

  // Remove listId from all articles that have it
  const articlesSnapshot = await db
    .collection('annotations')
    .where('listIds', 'array-contains', listId)
    .get();

  // Use batching for efficient updates
  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;

  articlesSnapshot.docs.forEach((articleDoc) => {
    currentBatch.update(articleDoc.ref, {
      listIds: FieldValue.arrayRemove(listId),
      updatedAt: Timestamp.now(),
    });
    operationCount++;

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
  for (const batch of batches) {
    await batch.commit();
  }

  // Delete the list
  await db.collection('lists').doc(listId).delete();
}

/**
 * Add an article to a list
 */
export async function addArticleToList(
  articleId: string,
  listId: string,
  userId: string
): Promise<void> {
  // Validate article ownership
  const articleDoc = await db.collection('annotations').doc(articleId).get();

  if (!articleDoc.exists) {
    throw new Error('Article not found');
  }

  const articleData = articleDoc.data()!;

  // Allow legacy docs (no userId) through, otherwise check ownership
  if (articleData.userId && articleData.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Validate list ownership
  const listDoc = await db.collection('lists').doc(listId).get();

  if (!listDoc.exists) {
    throw new Error('List not found');
  }

  const listData = listDoc.data()!;

  if (listData.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Add to listIds array (arrayUnion prevents duplicates)
  await db
    .collection('annotations')
    .doc(articleId)
    .update({
      listIds: FieldValue.arrayUnion(listId),
      updatedAt: Timestamp.now(),
    });
}

/**
 * Remove an article from a list
 */
export async function removeArticleFromList(
  articleId: string,
  listId: string,
  userId: string
): Promise<void> {
  // Validate article ownership
  const articleDoc = await db.collection('annotations').doc(articleId).get();

  if (!articleDoc.exists) {
    throw new Error('Article not found');
  }

  const articleData = articleDoc.data()!;

  // Allow legacy docs (no userId) through, otherwise check ownership
  if (articleData.userId && articleData.userId !== userId) {
    throw new Error('Unauthorized');
  }

  // Remove from listIds array
  await db
    .collection('annotations')
    .doc(articleId)
    .update({
      listIds: FieldValue.arrayRemove(listId),
      updatedAt: Timestamp.now(),
    });
}
