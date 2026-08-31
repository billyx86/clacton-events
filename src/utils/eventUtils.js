/**
 * Shared helpers for normalising, filtering and sorting event data.
 *
 * Events stored in Firestore carry an optional numeric `id` counter
 * (written by EventForm) *and* a Firestore document ID. The document ID is
 * the single source of truth for referencing an event; the counter is only
 * a legacy sort key.
 */

/**
 * Map a Firestore QueryDocumentSnapshot to a plain event object. The document
 * ID is the canonical `id`; the legacy numeric counter is preserved as
 * `legacyId` so old listings can still be sorted by it.
 */
export const toEvent = (snapshot) => {
  const data = snapshot.data();
  return {
    ...data,
    legacyId: data.id != null ? data.id : null,
    // Document ID is canonical; fall back to the counter for legacy docs
    // that somehow lost their document ID.
    id: snapshot.id || (data.id != null ? data.id : ''),
  };
};

/**
 * Events per page for the paginated events listing.
 */
export const EVENT_PAGE_SIZE = 20;

/**
 * Validate a user-provided URL before it is used in an `href`.
 *
 * Events store an arbitrary `websiteUrl` typed in by posters. Rendering it
 * directly in an `href` allows stored XSS: `javascript:alert(1)` (or a
 * `data:` text/html page) executes in the app's origin when clicked.
 * Only absolute `http:` / `https:` URLs are returned; everything else
 * (missing scheme, `javascript:`, `data:`, `vbscript:`, …) becomes `''`.
 */
export const sanitizeEventUrl = (raw) => {
  if (!raw) return '';
  const value = String(raw).trim();
  if (!value) return '';
  // Require an explicit scheme — relative paths are not valid event sites.
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
 * Get a displayable label for an event location.
 * Older events store a `{ label, ... }` object from the Places Autocomplete
 * `onLoad` payload; newer ones (and the current form) store a plain string.
 */
export const getLocationLabel = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  if (location.label) return location.label;
  return '';
};

/**
 * True if the event date is in the future (or missing — treated as unknown,
 * so we don't silently drop malformed documents).
 * Accepts a Firestore Timestamp, a Date, or anything with a `.toDate()` method.
 */
export const isEventUpcoming = (eventDate, now = new Date()) => {
  if (!eventDate) return false;
  let date;
  if (typeof eventDate.toDate === 'function') {
    date = eventDate.toDate();
  } else if (typeof eventDate.seconds === 'number') {
    // Plain Firestore-style { seconds } object.
    date = new Date(eventDate.seconds * 1000);
  } else {
    date = new Date(eventDate);
  }
  if (Number.isNaN(date.getTime())) return false;
  return date > now;
};

/**
 * Null-safe search filter over the title and descriptions.
 */
export const filterEventsByQuery = (events, searchQuery = '') => {
  const q = String(searchQuery || '').trim().toLowerCase();
  if (!q) return events;
  return events.filter((event) => {
    const haystack = [event.content, event.shortDescription, event.longDescription]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
};

/**
 * Sort events newest-first. Prefers the `createdOn` server timestamp,
 * falls back to the legacy numeric `id` counter, then to an empty tail.
 */
export const sortEventsByRecency = (events) => {
  const timestampValue = (event) => {
    if (!event) return null;
    if (event.createdOn && typeof event.createdOn.toDate === 'function') {
      return { v: 2, t: event.createdOn.toDate().getTime() };
    }
    if (event.createdOn && typeof event.createdOn.seconds === 'number') {
      return { v: 2, t: event.createdOn.seconds * 1000 };
    }
    const counter = Number(event.legacyId != null ? event.legacyId : event.id);
    if (Number.isFinite(counter) && counter > 0) {
      return { v: 1, t: counter };
    }
    return { v: 0, t: 0 };
  };

  return [...events].sort((a, b) => {
    const sa = timestampValue(a);
    const sb = timestampValue(b);
    if (sa.v !== sb.v) return sb.v - sa.v; // createdOn > counter > unknown
    return sb.t - sa.t;
  });
};

/**
 * Format a Firestore Timestamp / Date / seconds value for display.
 * Returns '' when there is nothing sensible to show.
 */
export const formatEventDate = (eventDate, options = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}) => {
  if (!eventDate) return '';
  const date = typeof eventDate.toDate === 'function'
    ? eventDate.toDate()
    : (typeof eventDate.seconds === 'number'
      ? new Date(eventDate.seconds * 1000)
      : new Date(eventDate));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', options);
};
