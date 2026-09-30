/**
 * Resolve the display name stored as an event's `author` (issue #12).
 *
 * EventForm reads the poster's `users/<email>` document and, historically,
 * used its `name` field — or nothing at all when the document was missing.
 * That left every event posted by a user without a `users/<email>` doc
 * (profile write failed at signup, pre-existing users, …) with
 * `author: ""`, which renders as a blank author on every event card.
 *
 * The resolver always returns a non-empty string, in priority order:
 *   1. the `name` field of the `users/<email>` document (source of truth),
 *   2. the auth user's `displayName`,
 *   3. the local part of the auth user's email,
 *   4. "Anonymous" (unreachable for a real Firebase auth user, but keeps
 *      the guarantee total).
 *
 * Pure on purpose: the Firestore `getDoc` call (and its try/catch) stays in
 * the component — the component feeds us `null` when the document is
 * missing *or* the read fails, and we fall back identically in both cases.
 */

const cleanString = (value) =>
  typeof value === 'string' ? value.trim() : '';

export const resolveAuthorName = (docData, user) => {
  const docName = cleanString(docData && docData.name);
  if (docName) return docName;

  const displayName = cleanString(user && user.displayName);
  if (displayName) return displayName;

  const email = cleanString(user && user.email);
  if (email) {
    const localPart = email.split('@')[0].trim();
    if (localPart) return localPart;
    return email;
  }

  return 'Anonymous';
};
