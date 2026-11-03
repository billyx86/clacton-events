import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { buildFeed } from './feedShaper.js';

// How many upcoming events the feed carries. A town-size listing is far
// below this; the cap keeps the response bounded and the query cheap.
export const MAX_FEED_EVENTS = 100;

/**
 * Assemble the public feed from Firestore.
 *
 * The query is deliberately single-field — a range `where` on `date` plus
 * an `orderBy` on the *same* `date` field — so it needs no composite
 * index (consistent with the index-free stance the rest of the app keeps).
 * The admin SDK reads with the privileged service account, so this works
 * without loosening the client security rules.
 *
 * @param {object} [deps]  Injection point for tests.
 * @param {object} [deps.db]  A Firestore instance (defaults to the app's
 *   admin Firestore).
 * @param {string} [deps.siteOrigin]  Absolute origin used for each entry's
 *   `url` (defaults to the EVENTS_SITE_ORIGIN env var).
 * @returns {Promise<{generatedAt: string, events: Array<object>}>}
 */
export const buildFeedResponse = async ({
  db,
  siteOrigin,
} = {}) => {
  const firestore = db || getFirestore();
  const origin = siteOrigin || process.env.EVENTS_SITE_ORIGIN || '';

  const collectionRef = firestore.collection('events');
  const snapshot = await collectionRef
    .where('date', '>=', Timestamp.now())
    .orderBy('date', 'asc')
    .limit(MAX_FEED_EVENTS)
    .get();

  return buildFeed(snapshot.docs, { siteOrigin: origin });
};

/**
 * HTTP request handler for the public feed. Kept as a plain
 * `(req, res) => Promise<void>` function (separate from the
 * firebase-functions export) so the response body, status codes and
 * headers can be unit-tested without spinning up the functions framework.
 *
 * Public and read-only — no auth. Allows cross-origin reads so newsletters
 * and other Clacton sites can fetch it directly from a browser or server.
 */
export const handleFeedRequest = (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    res.status(204).send('');
    return Promise.resolve();
  }
  if (req.method !== 'GET') {
    res.status(405).set('Allow', 'GET, OPTIONS').send(
      JSON.stringify({ error: 'Method not allowed. Use GET.' })
    );
    return Promise.resolve();
  }

  // Resolve the origin lazily so tests can stub buildFeedResponse.
  return buildFeedResponse()
    .then((feed) => {
      res
        .set('Content-Type', 'application/json; charset=utf-8')
        .status(200)
        .send(JSON.stringify(feed));
    })
    .catch((err) => {
      console.error('publicEventsFeed failed:', err);
      res
        .set('Content-Type', 'application/json; charset=utf-8')
        .status(500)
        .send(JSON.stringify({ error: 'Failed to build the event feed.' }));
    });
};
