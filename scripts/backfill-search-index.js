#!/usr/bin/env node
/**
 * One-time backfill of the denormalised `searchIndex` field (issue #26).
 *
 * EventForm maintains `searchIndex` at write time, but documents created
 * before that change have no index and would never match the server-side
 * `array-contains-any` search. This script walks the `events` collection
 * in batches and adds `searchIndex` to any document missing it, using the
 * exact same tokeniser (buildSearchIndex) the client uses, so backfilled
 * and newly-created documents are indistinguishable to the search query.
 *
 * Usage (from the repo root, with .env present):
 *
 *   node scripts/backfill-search-index.js            # all documents
 *   node scripts/backfill-search-index.js --dry-run  # count only, no writes
 *   node scripts/backfill-search-index.js --limit 50 # stop after 50 docs
 *
 * Idempotent: documents that already carry a non-empty searchIndex are
 * skipped, so re-running is a no-op. Firestore has no field-existence
 * query, so the script pages through the collection by __name__ and
 * filters client-side — fine for a town-size collection.
 */
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
} from 'firebase/firestore';

import { buildSearchIndex } from '../src/utils/searchTokens.js';

// The client app reads the same vars via import.meta.env (Vite,
// envPrefix: 'REACT_APP_' — see vite.config.mjs). Node doesn't auto-load
// .env, so pull it in here if present, then read the raw REACT_APP_*
// names. A plain .env parser keeps the script dependency-free.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // No .env file — fall through and the missing-var check below reports it.
}

const DRY_RUN = process.argv.includes('--dry-run');
const limitFlag = process.argv.indexOf('--limit');
const LIMIT = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : 0;

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) {
  console.error(
    `Missing Firebase env vars: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill them in first.'
  );
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

const batchSize = 200;
let scanned = 0;
let updated = 0;
let alreadyIndexed = 0;

console.log(DRY_RUN ? 'Dry run — counting documents, no writes.' : 'Backfilling searchIndex…');

let cursor = null;
for (;;) {
  const constraints = [orderBy('__name__'), limit(batchSize)];
  if (cursor != null) {
    constraints.splice(1, 0, startAfter(cursor));
  }
  const snapshot = await getDocs(query(collection(firestore, 'events'), ...constraints));
  const docsInBatch = snapshot.docs;
  if (docsInBatch.length === 0) break;
  cursor = docsInBatch[docsInBatch.length - 1];

  for (const docSnap of docsInBatch) {
    scanned += 1;
    const data = docSnap.data();
    const existing = data.searchIndex;
    if (Array.isArray(existing) && existing.length > 0) {
      alreadyIndexed += 1;
      continue;
    }

    const locationText =
      typeof data.location === 'string'
        ? data.location
        : data.location && typeof data.location === 'object'
          ? data.location.label
          : '';

    const index = buildSearchIndex({
      content: data.content,
      shortDescription: data.shortDescription,
      longDescription: data.longDescription,
      location: locationText,
    });

    if (DRY_RUN) {
      console.log(`  [dry-run] would index "${data.content ?? docSnap.id}" → ${index.length} tokens`);
      continue;
    }

    await updateDoc(doc(firestore, 'events', docSnap.id), {
      searchIndex: index,
    });
    updated += 1;
  }

  if (LIMIT > 0 && scanned >= LIMIT) {
    console.log(`Stopped at --limit ${LIMIT}.`);
    break;
  }
  if (docsInBatch.length < batchSize) break;
}

console.log(
  `\nDone. scanned=${scanned} updated=${updated} already-indexed=${alreadyIndexed}${DRY_RUN ? ' (dry run)' : ''}`
);
