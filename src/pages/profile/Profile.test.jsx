import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import Profile from './Profile.jsx';

// Capture the onAuthStateChanged callback so each test can fire auth
// state transitions itself (the real SDK resolves asynchronously).
let mockAuthCallback = null;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    mockAuthCallback = cb;
    return () => {
      mockAuthCallback = null;
    };
  },
}));

vi.mock('../../firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

// Marker rendered at /login so we can observe navigation without
// importing the real Login page (and its auth side effects).
const LoginProbe = () => <div>login-page</div>;

const renderAtProfile = () =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </MemoryRouter>
  );

test('logged-out visitor is redirected from /profile to /login (issue #17)', async () => {
  const { unmount } = renderAtProfile();
  await waitFor(() => expect(mockAuthCallback).toBeTypeOf('function'));

  await act(async () => {
    mockAuthCallback(null);
  });

  await waitFor(() =>
    expect(screen.getByText('login-page')).toBeInTheDocument()
  );
  unmount();
});

test('authenticated user is NOT redirected to /login (no flash)', async () => {
  const { auth } = await import('../../firebase');
  auth.currentUser = { email: 'alice@example.com' };

  const { unmount } = renderAtProfile();
  await waitFor(() => expect(mockAuthCallback).toBeTypeOf('function'));

  await act(async () => {
    mockAuthCallback({ uid: 'alice' });
  });

  // No user profile document exists yet, so the page shows its empty
  // state — but it must stay on /profile, not bounce to /login.
  await waitFor(() =>
    expect(screen.getByText('No user profile data.')).toBeInTheDocument()
  );
  expect(screen.queryByText('login-page')).not.toBeInTheDocument();

  auth.currentUser = null;
  unmount();
});
