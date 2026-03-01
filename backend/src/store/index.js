import path from 'node:path';
import { FirestoreStore } from './firestoreStore.js';
import { MemoryStore } from './memoryStore.js';
import { SQLiteStore } from './sqliteStore.js';

const provider = (process.env.STORAGE_PROVIDER ?? 'sqlite').toLowerCase();
const isNodeTestRun = process.argv.includes('--test') || Boolean(process.env.NODE_TEST_CONTEXT);

function resolveSqlitePath() {
  if (process.env.SQLITE_PATH) {
    return process.env.SQLITE_PATH;
  }

  if (isNodeTestRun || process.env.NODE_ENV === 'test') {
    return ':memory:';
  }

  return path.resolve(process.cwd(), '.data', 'padely.sqlite');
}

function createStore() {
  if (provider === 'sqlite') {
    return new SQLiteStore({ dbPath: resolveSqlitePath() });
  }

  if (provider === 'firestore') {
    return new FirestoreStore();
  }

  return new MemoryStore();
}

export const store = createStore();
export const storageProvider = provider;
