import React from 'react';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Main from './Main.jsx';

// Route smoke test (issue #18): after switching Main.jsx to React.lazy,
// each of the seven routes must still load its chunk and render. A broken
// lazy import rejects and leaves the route blank, so asserting on page
// content proves the chunk loaded.

// --- firebase/auth: capture onAuthStateChanged so each test can resolve
// the auth state itself.
let mockAuthCallback = null;
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    mockAuthCallback = cb;
    return () => {
      mockAuthCallback = null;
    };
  },
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('./firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

// --- firebase/firestore: safe empty-data stubs.
vi.mock('firebase/firestore', () => ({
  arrayUnion: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

// Google Places Autocomplete injects a <script> for the Maps API, which
// jsdom never loads — stub it out for the /list-event smoke render.
vi.mock('react-google-places-autocomplete', () => ({
  default: () => <input data-testid="places-mock" />,
}));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Main />
    </MemoryRouter>
  );

beforeEach(() => {
  mockAuthCallback = null;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('/ renders the home page', async () => {
  renderAt('/');
  await waitFor(() =>
    expect(screen.getByText('Welcome to Clacton Events!')).toBeInTheDocument()
  );
});

test('/events renders the events list (signed out)', async () => {
  renderAt('/events');
  await waitFor(() => expect(mockAuthCallback).toBeTypeOf('function'));
  await act(async () => {
    mockAuthCallback(null);
  });
  await waitFor(() =>
    expect(screen.getByText('Log in to post an event.')).toBeInTheDocument()
  );
});

test('/events/:id renders the event details page', async () => {
  renderAt('/events/some-event-id');
  await waitFor(() =>
    expect(screen.getByText('No event found.')).toBeInTheDocument()
  );
});

test('/login renders the login form', async () => {
  renderAt('/login');
  await waitFor(() =>
    expect(screen.getByText('Log In')).toBeInTheDocument()
  );
});

test('/signup renders the signup form', async () => {
  renderAt('/signup');
  await waitFor(() =>
    expect(screen.getAllByText('Sign Up').length).toBeGreaterThan(0)
  );
});

test('/list-event renders the posting form (signed in)', async () => {
  renderAt('/list-event');
  await waitFor(() => expect(mockAuthCallback).toBeTypeOf('function'));
  await act(async () => {
    mockAuthCallback({ uid: 'alice', email: 'alice@example.com' });
  });
  await waitFor(() =>
    expect(screen.getByText('List an Event')).toBeInTheDocument()
  );
});

test('/profile redirects a signed-out visitor to /login', async () => {
  renderAt('/profile');
  await waitFor(() => expect(mockAuthCallback).toBeTypeOf('function'));
  await act(async () => {
    mockAuthCallback(null);
  });
  // The Profile chunk loaded and its (issue #17) redirect fired, landing
  // on the real Login page.
  await waitFor(() =>
    expect(screen.getByText('Log In')).toBeInTheDocument()
  );
});
