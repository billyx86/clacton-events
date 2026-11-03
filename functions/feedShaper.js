/**
 * Pure shaping logic for the public JSON feed of upcoming events (#28).
 *
 * Kept dependency-free so it can be unit-tested without the Firebase SDKs
 * (and so the feed contract can be verified against the docs we actually
 * fetch, in one place). The Cloud Function in index.js is a thin wrapper
 * around these functions.
 *
 * Feed contract (stable, documented for newsletter embedders):
 *   {
 *     "generatedAt": "2026-11-03T02:00:00.000Z",   // ISO-8601 UTC
 *     "events": [
 *       {
 *         "id": "<firestore doc id>",
 *         "title": "…",            // non-empty string; event skipped if absent
 *         "date": "2026-11-03T12:00:00.000Z",  // ISO-8601 UTC, or null
 *         "location": "…",         // display label, '' when unknown
 *         "imageUrl": "…",         // absolute http(s) URL, '' when none
 *         "url": "https://<site>/events/<doc id>"  // always a full link
 *       },
 *       …
 *     ]
 *   }
 *
 * The array is sorted soonest-first by `date`; events with no/invalid
 * dates sort last (and preserve input order among themselves).
 */

/**
 * Pull a displayable location label out of an event document.
 *
 * Older events store a `{ label, ... }` object from the Places
 * Autocomplete payload; newer ones (and the current form) store a plain
 * string. Anything else (missing, malformed) becomes ''.
 */
export const locationLabel = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location.trim();
  if (typeof location === 'object' && typeof location.label === 'string') {
    return location.label.trim();
  }
  return '';
};

/**
 * Millisecond epoch value of a Firestore date field: a Timestamp
 * (anything with `.toDate()`), a `{ seconds }` object, or a plain
 * Date/string. Returns null when the value is missing or unparseable.
 */
export const dateToMillis = (date) => {
  if (date == null) return null;
  if (typeof date.toDate === 'function') {
    const t = date.toDate().getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof date.seconds === 'number') {
    return date.seconds * 1000;
  }
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Validate an event imageUrl before it goes into a public feed.
 *
 * Event posters can type an arbitrary URL into the form; the app already
 * sanitizes `websiteUrl` for exactly this reason (stored-XSS via
 * `javascript:` / `data:` payloads in eventUtils.sanitizeEventUrl). The
 * feed is consumed by third-party newsletters, so it applies the same
 * bar: only absolute http/https URLs pass through; everything else —
 * missing, relative, or exotic-scheme — becomes ''.
 */
export const safeImageUrl = (raw) => {
  if (!raw) return '';
  const value = String(raw).trim();
  if (!value) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return '';
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    ? value
    : '';
};

/**
 * Map one Firestore event document to the feed entry shape, or null when
 * the document is not publishable (no title — a feed entry without a
 * title is useless, and dropping it keeps the contract honest).
 *
 * @param {object} doc  `{ id, data: { …fields } }` — a QueryDocument
 *   snapshot-like shape (doc.id + doc.data()).
 * @param {string} siteOrigin  Absolute origin of the event site, e.g.
 *   `https://clacton-events.web.app` (no trailing slash). Used to build
 *   the per-event `url` field.
 */
export const toFeedEntry = (doc, siteOrigin) => {
  const data = (doc && doc.data && typeof doc.data === 'function')
    ? doc.data()
    : doc;
  const title = data.content != null ? String(data.content).trim() : '';
  if (!title) return null;

  const dateMillis = dateToMillis(data.date);
  const origin = String(siteOrigin || '').replace(/\/+$/, '');
  return {
    id: doc.id != null ? String(doc.id) : '',
    title,
    date: dateMillis == null ? null : new Date(dateMillis).toISOString(),
    location: locationLabel(data.location),
    imageUrl: safeImageUrl(data.imageUrl),
    url: origin ? `${origin}/events/${encodeURIComponent(doc.id)}` : '',
  };
};

/**
 * Shape a whole batch of event documents into the public feed payload:
 * drops unpublishable docs, sorts soonest-first (undated last, stable
 * among themselves) and stamps generatedAt.
 *
 * @param {Array} docs        Firestore-like docs (see toFeedEntry).
 * @param {object} [options]
 * @param {string} [options.siteOrigin]  Site origin for the `url` field.
 * @param {Date}   [options.now]         Injection point for tests.
 * @returns {{ generatedAt: string, events: Array<object> }}
 */
export const buildFeed = (docs, { siteOrigin, now = new Date() } = {}) => {
  const entries = (docs || [])
    .map((doc) => toFeedEntry(doc, siteOrigin))
    .filter((entry) => entry != null);

  // Soonest-first; null/undated entries sort to the end. The Date
  // constructor is applied at compare time so the entries themselves
  // stay plain ISO strings (JSON-serializable, stable contract).
  entries.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : Infinity;
    const tb = b.date ? new Date(b.date).getTime() : Infinity;
    return ta - tb;
  });

  return {
    generatedAt: now.toISOString(),
    events: entries,
  };
};
