import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';

import EventsPage from './EventsPage.jsx';

// Capture the onAuthStateChanged callback so tests can drive auth state.
// vi.hoisted keeps the mutable handle above the hoisted vi.mock factories.
const { mockAuth } = vi.hoisted(() => ({ mockAuth: { cb: null } }));

vi.mock('../firebase', () => ({
  auth: {},
  db: {},
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
  getDocs: vi.fn(),
  limit: vi.fn((n) => ({ limit: n })),
  orderBy: vi.fn((field, dir) => ({ orderBy: [field, dir] })),
  query: vi.fn((...args) => ({ type: 'query', args })),
  startAfter: vi.fn((cursor) => ({ startAfter: cursor })),
}));

// Isolate from the real Event component (its CSS import + navigate side
// effects are irrelevant to the search-scope contract under test).
vi.mock('../components/Event', () => ({
  default: ({ id, title }) => (
    <section data-testid={`event-${id}`}>
      <h3 data-testid="event-title">{title}</h3>
    </section>
  ),
}));

// A Firestore-style doc snapshot whose data() yields the fields toEvent()
// spreads. Dates are far in the future so isEventUpcoming keeps them.
const futureDate = () => new Date('2030-06-01T12:00:00Z');

const makeDoc = (id, { title, description = '', longDescription = '' }) => ({
  id,
  data: () => ({
    content: title,
    shortDescription: description,
    longDescription,
    location: {},
    date: futureDate(),
    id: Number(id.replace(/\D/g, '')) || 0,
  }),
});

const makeSnapshot = (docs) => ({ docs });

// 25 events, newest-first on the server: page 1 = ids 25..6 (the newest
// 20), page 2 = ids 5..1 (the older five).
const buildAllDocs = () => {
  const page1 = [];
  const page2 = [];
  for (let i = 25; i >= 6; i--) {
    page1.push(makeDoc(`doc-${i}`, { title: `Event ${i}` }));
  }
  for (let i = 5; i >= 1; i--) {
    page2.push(makeDoc(`doc-${i}`, { title: `Event ${i}` }));
  }
  // Distinct search tokens: "ZebraFest" only on a page-2 doc (rank 21+),
  // "JazzNight" only on a page-1 doc.
  page2[page2.length - 1] = makeDoc('doc-1', { title: 'ZebraFest' });
  page1[14] = makeDoc('doc-11', { title: 'JazzNight' });
  return { page1, page2 };
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/events']}>
      <EventsPage />
    </MemoryRouter>
  );

// Queue successive getDocs pages (call 1 = initial load, call 2 = Load more).
const queuePages = (pages) => {
  let call = 0;
  vi.mocked(getDocs).mockImplementation(async () => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return makeSnapshot(page);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.cb = null;
});

test('search is scoped to loaded events — hint is always visible and the old placeholder is gone (issue #22)', () => {
  queuePages([[], []]);
  renderPage();

  const input = screen.getByPlaceholderText('Filter loaded events…');
  expect(input).toBeInTheDocument();

  // Regression guard: the placeholder must no longer imply collection-wide
  // search.
  expect(input).not.toHaveAttribute('placeholder', 'Search events...');
  expect(screen.getByTestId('search-scope-hint')).toHaveTextContent(
    /loaded so far/i
  );
  expect(screen.getByTestId('search-scope-hint')).toHaveTextContent(
    /load more/i
  );
});

test('a term that only exists on an unloaded page returns nothing, with the scope hint shown (issue #22)', async () => {
  const { page1, page2 } = buildAllDocs();
  queuePages([page1, page2]);
  renderPage();

  // Let the initial page settle.
  await waitFor(() =>
    expect(screen.getAllByTestId('event-title')).toHaveLength(20)
  );

  fireEvent.change(screen.getByPlaceholderText('Filter loaded events…'), {
    target: { value: 'ZebraFest' },
  });

  // ZebraFest is only in doc 25 (page 2), which is not loaded yet.
  expect(screen.queryAllByTestId('event-title')).toHaveLength(0);
  // The honest hint is what tells the user to Load more.
  expect(screen.getByTestId('search-scope-hint')).toHaveTextContent(
    /loaded so far/i
  );
});

test('a term in the first page matches without loading more (issue #22)', async () => {
  const { page1, page2 } = buildAllDocs();
  queuePages([page1, page2]);
  renderPage();

  await waitFor(() =>
    expect(screen.getAllByTestId('event-title')).toHaveLength(20)
  );

  const input = screen.getByPlaceholderText('Filter loaded events…');
  fireEvent.change(input, { target: { value: 'JazzNight' } });

  await waitFor(() =>
    expect(screen.getByText('JazzNight')).toBeInTheDocument()
  );
  expect(screen.getAllByTestId('event-title')).toHaveLength(1);
});

test('after Load more, a page-2 term becomes matchable — the filter covers the full loaded set (issue #22)', async () => {
  const { page1, page2 } = buildAllDocs();
  queuePages([page1, page2]);
  renderPage();

  await waitFor(() =>
    expect(screen.getAllByTestId('event-title')).toHaveLength(20)
  );

  const input = screen.getByPlaceholderText('Filter loaded events…');
  fireEvent.change(input, { target: { value: 'ZebraFest' } });
  expect(screen.queryAllByTestId('event-title')).toHaveLength(0);

  // Load page 2.
  fireEvent.click(screen.getByRole('button', { name: /load more events/i }));

  await waitFor(() =>
    expect(screen.getByText('ZebraFest')).toBeInTheDocument()
  );
  // The now-loaded page-2 doc is found by the same query.
  expect(screen.getAllByTestId('event-title')).toHaveLength(1);
});

test('an empty query shows every loaded upcoming event (issue #22)', async () => {
  const { page1, page2 } = buildAllDocs();
  queuePages([page1, page2]);
  renderPage();

  await waitFor(() =>
    expect(screen.getAllByTestId('event-title')).toHaveLength(20)
  );

  // Empty query: no filtering, all 20 loaded (upcoming) events render.
  const input = screen.getByPlaceholderText('Filter loaded events…');
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getAllByTestId('event-title')).toHaveLength(20);
});
