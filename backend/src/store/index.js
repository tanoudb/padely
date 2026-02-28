import { FirestoreStore } from './firestoreStore.js';
import { MemoryStore } from './memoryStore.js';

const provider = (process.env.STORAGE_PROVIDER ?? 'memory').toLowerCase();

function createStore() {
  if (provider === 'firestore') {
    return new FirestoreStore();
  }

  return new MemoryStore();
}

export const store = createStore();
export const storageProvider = provider;
