import * as admin from 'firebase-admin';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

type RawServiceAccount = admin.ServiceAccount & {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

const normalizeServiceAccount = (raw: RawServiceAccount): admin.ServiceAccount => {
  const projectId = raw.projectId ?? raw.project_id;
  const clientEmail = raw.clientEmail ?? raw.client_email;
  const privateKey = (raw.privateKey ?? raw.private_key)?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase service account is missing required fields (projectId, clientEmail, privateKey).'
    );
  }

  return { projectId, clientEmail, privateKey };
};

const loadServiceAccount = (): admin.ServiceAccount => {
  const envValue = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!envValue) {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_KEY. Use the same base64-encoded service account JSON in local and Vercel environments.'
    );
  }

  const trimmed = envValue.trim();

  try {
    const decoded = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded) as RawServiceAccount;
    return normalizeServiceAccount(parsed);
  } catch (error) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY value:', error);
    throw new Error(
      'Invalid FIREBASE_SERVICE_ACCOUNT_KEY. Provide a valid base64-encoded or raw JSON Firebase service account.'
    );
  }
};

let initializationError: Error | null = null;

export const ensureFirebaseAdmin = () => {
  if (admin.apps.length) return;
  if (initializationError) throw initializationError;

  try {
    const credential = admin.credential.cert(loadServiceAccount());
    admin.initializeApp({ credential });
  } catch (error) {
    initializationError =
      error instanceof Error ? error : new Error('Failed to initialize Firebase Admin SDK');
    throw initializationError;
  }
};

const getDb = (): Firestore => {
  ensureFirebaseAdmin();
  return getFirestore();
};

export const db = new Proxy({} as Firestore, {
  get(_target, property) {
    const firestore = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = firestore[property];
    return typeof value === 'function' ? value.bind(firestore) : value;
  },
}) as Firestore;
