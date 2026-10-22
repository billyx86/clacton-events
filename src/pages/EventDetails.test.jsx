import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import EventDetails from './EventDetails.jsx';
import { auth } from '../firebase';
import { getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// Firebase is fully mocked. `doc` returns a small descriptor so the shared
// `getDoc` mock can tell the event fetch apart from the user-document fetch.
vi.mock('../firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collectionName, key) => ({ collectionName, key })),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  arrayUnion: vi.fn((value) => ({ __op: 'arrayUnion', value })),
  arrayRemove: vi.fn((value) => ({ __op: 'arrayRemove', value })),
}));

const EVENT_ID = 'seaside-festival';

const eventDoc = () => ({
  exists: () => true,
  id: EVENT_ID,
  data: () => ({
    content: 'Seaside Festival',
    shortDescription: 'A fun day out',
    longDescription: 'Lots of fun by the sea.',
    location: 'Clacton Pier',
    date: { seconds: 4102444800 }, // 2100-01-01, always upcoming
    websiteUrl: 'https://example.com',
  }),
});

// `interestedEvents === undefined` models a user document without the field.
const userDoc = (interestedEvents) => ({
  exists: () => true,
  data: () => (interestedEvents === undefined ? {} : { interestedEvents }),
});

let userInterestedEvents = [];

const renderEventPage = () =>
  render(
    <MemoryRouter initialEntries={[`/events/${EVENT_ID}`]}>
      <Routes>
        <Route path="/events/:id" element={<EventDetails />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.currentUser = null;
  userInterestedEvents = [];
  getDoc.mockImplementation(async (ref) => {
    if (ref.collectionName === 'events') return eventDoc();
    if (ref.collectionName === 'users') return userDoc(userInterestedEvents);
    return { exists: () => false, data: () => ({}) };
  });
});

afterEach(() => {
  cleanup();
});

test('not interested: clicking adds the event and flips the label (issue #23)', async () => {
  auth.currentUser = { email: 'alice@example.com' };

  renderEventPage();
  const button = await screen.findByText("I'm Interested");

  fireEvent.click(button);

  await waitFor(() => expect(arrayUnion).toHaveBeenCalledWith(EVENT_ID));
  expect(updateDoc).toHaveBeenCalledWith(
    expect.objectContaining({ collectionName: 'users' }),
    { interestedEvents: { __op: 'arrayUnion', value: EVENT_ID } }
  );
  expect(await screen.findByText('Interested ✓')).toBeInTheDocument();
});

test('already interested: clicking withdraws the event (issue #23)', async () => {
  auth.currentUser = { email: 'alice@example.com' };
  userInterestedEvents = [EVENT_ID];

  renderEventPage();
  const button = await screen.findByText('Interested ✓');

  fireEvent.click(button);

  await waitFor(() => expect(arrayRemove).toHaveBeenCalledWith(EVENT_ID));
  expect(updateDoc).toHaveBeenCalledWith(
    expect.objectContaining({ collectionName: 'users' }),
    { interestedEvents: { __op: 'arrayRemove', value: EVENT_ID } }
  );
  expect(await screen.findByText('Interest removed.')).toBeInTheDocument();
});

test('label reflects stored interest on mount (issue #23)', async () => {
  auth.currentUser = { email: 'alice@example.com' };
  userInterestedEvents = [EVENT_ID];

  renderEventPage();

  expect(await screen.findByText('Interested ✓')).toBeInTheDocument();
});

test('signed-out user: clicking does nothing and explains why (regression)', async () => {
  auth.currentUser = null;

  renderEventPage();
  const button = await screen.findByText("I'm Interested");

  fireEvent.click(button);

  expect(
    await screen.findByText('You must be logged in to show interest.')
  ).toBeInTheDocument();
  expect(updateDoc).not.toHaveBeenCalled();
});

test('user document without an interestedEvents field does not crash (issue #23)', async () => {
  auth.currentUser = { email: 'alice@example.com' };
  userInterestedEvents = undefined; // field missing entirely

  renderEventPage();
  const button = await screen.findByText("I'm Interested");

  fireEvent.click(button);

  await waitFor(() => expect(arrayUnion).toHaveBeenCalledWith(EVENT_ID));
});
