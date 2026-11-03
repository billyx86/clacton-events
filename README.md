# Clacton Events

A community events app for Clacton-on-Sea. Browse upcoming local events,
view details, mark your interest, and list your own — for free.

Built with React (Vite) and Firebase (Auth, Firestore, Storage).

## Features

- **Events** — upcoming local listings with image, location, date and
  descriptions; full-text search over titles and descriptions.
- **Event details** — longer description, contact info and website link.
- **Interests** — signed-in users can mark events they're interested in
  and see them on their profile (upcoming only).
- **Post an event** — title, descriptions, date, location (Google Places
  autocomplete) and image (URL or upload, auto-resized to keep uploads
  small; uploads are capped at 8 MB with a live preview, and decode/upload
  failures are surfaced inline instead of failing silently).
- **Accounts** — personal and business sign-ups.
- **Public JSON feed** — a no-auth Cloud Function exposing upcoming events
  for newsletters and other Clacton sites to embed (see "Public JSON feed").

## Getting started

```bash
npm install
```

### Firebase configuration

The app reads its Firebase config from environment variables. Copy
`.env.example` to a `.env` file in the project root and fill it in:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_MEASUREMENT_ID=...
```

The Google Places Autocomplete widget in the event form and the static
location map on event details both use the key in
`REACT_APP_GMAPS_STATIC_KEY` (a Static Maps / Places API key — restrict
it in the Google Cloud console to the origins you serve from):

```
REACT_APP_GMAPS_STATIC_KEY=***
```

> **Note:** Firebase web API keys and restricted Google Maps keys are
> public by design — they're scoped by your project's Auth/Firestore
> rules and API restrictions, not by keeping the key secret. Keep the
> *rules* strict.

### Data model

Two Firestore collections:

| Collection | Document ID | Fields |
|------------|-------------|--------|
| `events`   | auto (canonical event ID) | `content`, `shortDescription`, `longDescription`, `date` (Timestamp), `imageUrl`, `websiteUrl`, `location` (string or `{label}`), `searchIndex` (denormalised string array of lowercased tokens for server-side search, issue #26), `id` (legacy numeric counter), `createdOn`, `author`, `emailOfAuthor` (**immutable** — set to the creator's email on write and can never be changed; security rules scope event update/delete to this field, see "Security rules" below) |
| `users`    | user's email address | `name`, `email`, `photoURL`, `created_at`, `accountType` (`personal` / `business`), `interestedEvents` (array of event **document** IDs) |

`events/id` is a legacy counter kept only as a sort key for older
listings; new events rely on the Firestore document ID plus the
`createdOn` server timestamp. A `counters/eventCounter` document is
maintained transactionally so concurrent posters can't collide.

### Security rules

Events are public to read but **author-scoped to write** (issue #16):
`firestore.rules` only lets the user whose email matches the event's
`emailOfAuthor` update or delete it, requires a create to stamp
`emailOfAuthor` with the writer's own email, and treats
`emailOfAuthor` as immutable so ownership can't be reassigned by an
edit. Rules are exercised by `firebase/firestore.rules.test.js` against
the real rules engine (the CI `rules` job).

**Legacy events:** events created before `emailOfAuthor` existed carry
no owner claim and are fail-closed — no signed-in user can update or
delete them until the field is backfilled. A one-off backfill (e.g. via
the Firebase console or an admin script) is required to restore
ownership of those documents.

## Public JSON feed

A public, read-only Cloud Function (`publicEventsFeed`) exposes upcoming
events as JSON so local newsletters and other Clacton sites can embed
them without an account. It's served over HTTPS with no auth and
permissive CORS (`Access-Control-Allow-Origin: *`), so it can be fetched
directly from a browser or a server.

After deploying, the endpoint lives at:

```
https://<region>-<project>.cloudfunctions.net/publicEventsFeed
```

(Region is set by your Firebase project — typically `europe-west2` for
EU deployments. The response is cached for 5 minutes.)

### Response shape (stable contract)

```jsonc
{
  "generatedAt": "2026-11-03T02:00:00.000Z",   // ISO-8601 UTC
  "events": [
    {
      "id": "docId",
      "title": "Clacton Food Festival",        // event.content
      "date": "2026-11-14T10:00:00.000Z",      // ISO-8601 UTC, or null
      "location": "Seafront, Clacton",          // display label, '' if none
      "imageUrl": "https://…/image.jpg",        // http(s) URL, '' if none
      "url": "https://<site>/events/docId"      // absolute link to the event page
    }
  ]
}
```

- Only **upcoming** events (date >= now) are included, soonest-first,
  capped at 100.
- Documents without a title are dropped.
- `imageUrl` is sanitised: only absolute `http(s)` URLs are emitted —
  `javascript:`, `data:` and relative values become `''` (the same
  bar the app applies to `websiteUrl`).
- The `url` field is built from the `EVENTS_SITE_ORIGIN` env var on the
  function (e.g. `https://clacton-events.web.app`); leave it unset and
  `url` is `''`.

### Deploying the function

```bash
cd functions && npm install
```

Then deploy:

```bash
firebase deploy --only functions:publicEventsFeed
```

The `url` field is built from `EVENTS_SITE_ORIGIN` on the function. It's
a regular function env var — set it once (optional; leave unset and
`url` is `''`):

```bash
gcloud functions params set EVENTS_SITE_ORIGIN "https://clacton-events.web.app" \
  --function=publicEventsFeed --region=<region>
```

For a quick local run, `functions:shell` loads `functions/.env`:

```bash
cd functions && npm run shell
```

The feed's pure shaping logic (`feedShaper.js`) and request handler
(`feedHandler.js`) are covered by unit tests in the CI `functions` job —
no emulator or Firebase project required.

## Development

```bash
npm start          # dev server on :3000
npm test           # unit tests (Vitest)
npm run build      # production build
```

## Project structure

```
src/
  firebase.js              # Firebase init (auth, firestore, storage)
  main.jsx                 # entry point
  App.jsx                  # layout
  Main.jsx                 # router
  components/
    Header.jsx             # nav + auth-aware user menu
    Event.jsx              # event card
  pages/
    Home.jsx               # hero + 3 most recent events
    EventsPage.jsx         # full listing with search
    EventDetails.jsx       # detail view + "I'm interested"
    auth/Login.jsx, Signup.jsx
    posting/EventForm.jsx  # list a new event
    profile/Profile.jsx    # user's upcoming interested events
  utils/
    eventUtils.js          # normalising / filtering / sorting helpers
    eventUtils.test.js     # unit tests for the helpers
    searchTokens.js        # search tokeniser + denormalised index (#26)
    searchTokens.test.js   # unit tests for the tokeniser
    authorName.js          # resolves the non-empty event author (issue #12)
    authorName.test.js     # unit tests for the author resolver
  scripts/
    backfill-search-index.js  # one-off searchIndex backfill (#26)
firebase/
  firestore.rules          # Firestore security rules
  firestore.rules.test.js  # rules tests (run against the emulator)
functions/
  index.js                 # publicEventsFeed Cloud Function export (#28)
  feedHandler.js           # HTTP handler + index-free Firestore query
  feedShaper.js            # pure, testable feed-shaping logic
  feedShaper.test.js       # feed contract unit tests
  feedHandler.test.js      # handler/query unit tests (mocked Firestore)
```

## Testing

Unit tests run with Vitest (jsdom environment, jest-dom matchers):

```bash
npm test            # single run (used by CI)
npm run test:watch  # watch mode
```

The Cloud Functions package has its own Vitest suite (plain Node, no
jsdom/emulator — the Firestore surface is mocked):

```bash
cd functions
npm install
npm test            # feedShaper + feedHandler unit tests
```

Firestore security rules are verified against the real rules engine using the
local Firestore emulator (`@firebase/rules-unit-testing` + `firebase-tools`).
The emulator needs a Java runtime. CI runs this automatically; locally:

```bash
npx firebase emulators:start --only firestore --project demo-clacton-events &
node firebase/firestore.rules.test.js
```

The rules model:

- `events/{eventId}` — anyone may read (`get`, `list`); only signed-in users
  may create, update, or delete.
- `users/{uid}` — a user may read only their own document (`get`, owner only).
