import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { runTransaction } from 'firebase/firestore';

import EventForm from './EventForm.jsx';

// vi.hoisted: keep mutable handles above the hoisted vi.mock factories.
const { mockAuth, txCapture } = vi.hoisted(() => ({
  mockAuth: { cb: null },
  // Every transaction.set(ref, data) the form performs lands here, so the
  // test can find the event document (the one carrying `searchIndex`).
  txCapture: { sets: [] },
}));

vi.mock('../../firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    mockAuth.cb = cb;
    return () => {
      mockAuth.cb = null;
    };
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' })),
  doc: vi.fn(() => ({ type: 'doc' })),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  serverTimestamp: vi.fn(() => ({ type: 'serverTimestamp' })),
  Timestamp: {
    fromDate: vi.fn((d) => ({ type: 'timestamp', value: d })),
  },
  // runTransaction is driven manually so the test can capture the exact
  // document the form writes. The counter doc (issue #19's atomic bump)
  // resolves to "missing" so the event gets id 1.
  runTransaction: vi.fn(async (_db, callback) => {
    const counterSnap = { exists: () => false, data: () => ({}) };
    await callback({
      get: vi.fn(async () => counterSnap),
      update: vi.fn(),
      set: vi.fn((ref, data) => {
        txCapture.sets.push({ ref, data });
      }),
    });
  }),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ type: 'storageRef' })),
  uploadBytes: vi.fn(async () => ({})),
  getDownloadURL: vi.fn(async () => 'https://example.com/img.jpg'),
}));

// Places Autocomplete injects a Maps <script> jsdom never loads.
vi.mock('react-google-places-autocomplete', () => ({
  default: () => <input data-testid="places-mock" />,
}));

// Isolate the author-name resolution from its Firestore read.
vi.mock('../../utils/authorName', () => ({
  resolveAuthorName: () => 'Alice',
}));

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={['/list-event']}>
      <EventForm />
    </MemoryRouter>
  );

const fillForm = async () => {
  fireEvent.change(screen.getByPlaceholderText('Event Title'), {
    target: { value: 'Jazz Night on the Pier' },
  });
  fireEvent.change(screen.getByPlaceholderText('Short Description'), {
    target: { value: 'Live band by the seafront' },
  });
  fireEvent.change(screen.getByPlaceholderText('Long Description'), {
    target: { value: 'Doors at eight, bring a coat for the sea air' },
  });
  fireEvent.change(screen.getByPlaceholderText('Image URL'), {
    target: { value: 'https://example.com/poster.jpg' },
  });
  fireEvent.change(screen.getByPlaceholderText(/date/i), {
    target: { value: '2030-06-01T12:00' },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.cb = null;
  txCapture.sets = [];
});

test('submitting writes the denormalised searchIndex field onto the event document (issue #26)', async () => {
  renderForm();
  await waitFor(() => expect(mockAuth.cb).toBeTypeOf('function'));
  await act(async () => {
    mockAuth.cb({ uid: 'alice', email: 'alice@example.com' });
  });
  await waitFor(() =>
    expect(screen.getByText('List an Event')).toBeInTheDocument()
  );

  await fillForm();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /submit event/i }));
  });

  // Wait for the transaction to run.
  await waitFor(() => expect(runTransaction).toHaveBeenCalledTimes(1));

  // Find the event document among the transaction's set() calls — the one
  // carrying the new event's fields (the counter set has only `count`).
  const eventSet = txCapture.sets.find(
    (entry) => entry.data && 'content' in entry.data
  );
  expect(eventSet).toBeDefined();

  const written = eventSet.data;
  // The index is present and is a plain array (a Firestore field value).
  expect(Array.isArray(written.searchIndex)).toBe(true);
  // It draws tokens from the title, both descriptions, and the default
  // location ("Clacton-on-Sea" → clacton, on, sea).
  expect(written.searchIndex).toEqual([
    'jazz',
    'night',
    'on',
    'the',
    'pier',
    'live',
    'band',
    'by',
    'seafront',
    'doors',
    'at',
    'eight',
    'bring',
    'coat',
    'for',
    'sea',
    'air',
    'clacton',
  ]);
  // The rest of the document is intact.
  expect(written.content).toBe('Jazz Night on the Pier');
  expect(written.author).toBe('Alice');
});

