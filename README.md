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
| `events`   | auto (canonical event ID) | `content`, `shortDescription`, `longDescription`, `date` (Timestamp), `imageUrl`, `websiteUrl`, `location` (string or `{label}`), `id` (legacy numeric counter), `createdOn`, `author`, `emailOfAuthor` |
| `users`    | user's email address | `name`, `email`, `photoURL`, `created_at`, `accountType` (`personal` / `business`), `interestedEvents` (array of event **document** IDs) |

`events/id` is a legacy counter kept only as a sort key for older
listings; new events rely on the Firestore document ID plus the
`createdOn` server timestamp. A `counters/eventCounter` document is
maintained transactionally so concurrent posters can't collide.

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
    authorName.js          # resolves the non-empty event author (issue #12)
    authorName.test.js     # unit tests for the author resolver
firebase/
  firestore.rules          # Firestore security rules
  firestore.rules.test.js  # rules tests (run against the emulator)
```

## Testing

Unit tests run with Vitest (jsdom environment, jest-dom matchers):

```bash
npm test            # single run (used by CI)
npm run test:watch  # watch mode
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
