/**
 * Shared helpers for the denormalised event search index (issue #26).
 *
 * Firestore has no native full-text search. The chosen path (option (b)
 * from the issue) is a denormalised `searchIndex` field on each event
 * document: a de-duplicated array of lowercased tokens drawn from the
 * title and descriptions. EventsPage queries it with
 * `where('searchIndex', 'array-contains-any', tokens)` — a single-field
 * query, so it needs no composite index — and post-filters client-side
 * (every token must match, and the result must be in the active view).
 *
 * The tokeniser here is the single source of truth for both sides of the
 * pipeline: EventForm builds the document's index with `buildSearchIndex`,
 * EventsPage tokenises the user's query with `tokenizeSearchQuery`.
 * Keeping them in one module means the two can't drift apart.
 */

/**
 * Firestore caps `array-contains-any` operand arrays at 50 values. The
 * client sends at most this many tokens per search; extra tokens are
 * still enforced by the client-side post-filter over the retrieved docs.
 */
export const MAX_QUERY_TOKENS = 50;

/**
 * How many documents a server-side search pulls (issue #26). Search is a
 * one-shot result set (no pagination on the results) — 50 is plenty for a
 * town-size event list, and anything beyond that would overwhelm the
 * client-side post-filter anyway.
 */
export const SEARCH_PAGE_SIZE = 50;

/**
 * Cap on how many tokens a single event's searchIndex may hold. It keeps
 * reads cheap and prevents a pathological 5000-word longDescription from
 * bloating every document read on the events page.
 */
export const MAX_INDEX_TOKENS = 200;

/**
 * Tokenise arbitrary text for the search index.
 *
 * - lowercases
 * - splits on anything that is not a letter, digit, or underscore
 *   (punctuation, spaces, emoji, dashes…)
 * - drops tokens shorter than 2 chars ("a", "i" match everything)
 * - de-duplicates, preserving first-seen order
 */
export const tokenizeText = (text) => {
  if (!text) return [];
  const tokens = String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/u)
    .filter((token) => token.length >= 2);
  // de-dup preserving order
  return [...new Set(tokens)];
};

/**
 * Build the `searchIndex` field value for an event document.
 *
 * Accepts the raw event fields as EventForm assembles them: `content`,
 * `shortDescription`, `longDescription`, and `location` (a string, or a
 * `{ label }` object from the Places Autocomplete payload). The array is
 * de-duplicated and capped at MAX_INDEX_TOKENS.
 */
export const buildSearchIndex = (eventFields = {}) => {
  const { content, shortDescription, longDescription, location } = eventFields;
  const locationText =
    typeof location === 'string'
      ? location
      : location && typeof location === 'object'
        ? location.label
        : '';
  const tokens = tokenizeText(
    [content, shortDescription, longDescription, locationText]
      .filter(Boolean)
      .join(' ')
  );
  return tokens.slice(0, MAX_INDEX_TOKENS);
};

/**
 * Tokenise a user's search query for the `array-contains-any` operand.
 * Empty / whitespace queries yield [] (the page treats that as "no
 * search active" and shows the listing instead).
 */
export const tokenizeSearchQuery = (searchQuery) => {
  const tokens = tokenizeText(searchQuery);
  return tokens.slice(0, MAX_QUERY_TOKENS);
};
