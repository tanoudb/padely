import { seedDemoData } from './seed.js';
import { storageProvider, store } from './index.js';

const before = (await store.listUsers()).length;
await seedDemoData();
const after = (await store.listUsers()).length;
const inserted = Math.max(0, after - before);
console.log(`seed complete (provider=${storageProvider} inserted=${inserted} total=${after})`);
