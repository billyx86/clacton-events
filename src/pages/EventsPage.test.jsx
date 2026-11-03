import React from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';

import EventsPage from './EventsPage.jsx';

// Capture the onAuthStateChanged callback so tests can drive auth state.
// vi.hoisted keeps the mutable handle above the hoisted vi.mock factories.
const { mockAuth } = vi.hoisted(() => ({ mockAuth: { cb: null } }));

// A fixed "now" for the server-side date filter (issue #27). All test
// events are dated 2030-06-01, so with now = 2030-01-01 every document
// is upcoming and date-ascending order matches the given page order.
const fakeNow = new Date('2030-01-01T00:00:00Z');

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
  Timestamp: { now: vi.fn(() => fakeNow) },
  where: vi.fn((field, op, value) => ({ where: [field, op, value] })),
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

const futureDate = () => new Date('2030-06-01T12:00:00Z');
const pastDate = () => new Date('2025-06-01T12:00:00Z');
// A date ordered *before* futureDate() but still upcoming — used to prove
// search results sort soonest-first client-side (the query carries no
// orderBy, by design).
const soonDate = () => new Date('2030-02-01T12:00:00Z');

// searchIndex is what the server searches over (issue #26). Docs get a
// default index unless overridden — the test data is built around
// distinct tokens ("ZebraFest" / "JazzNight").
const makeDoc = (id, {
  title,
  description = '',
  longDescription = '',
  searchIndex = [title.toLowerCase()],
  date = futureDate(),
}) => ({
  id,
  data: () => ({
    content: title,
    shortDescription: description,
    longDescription,
    location: {},
    date,
    createdOn: futureDate(),
    searchIndex,
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
  // Distinct search tokens: "ZebraFest" only on a page-2 doc, "JazzNight"
  // only on a page-1 doc. The server would return exactly these.
  page2[page2.length - 1] = makeDoc('doc-1', {
    title: 'ZebraFest',
    searchIndex: ['zebrafest'],
  });
  page1[14] = makeDoc('doc-11', {
    title: 'JazzNight',
    searchIndex: ['jazznight', 'jazz', 'night'],
  });
  return { page1, page2 };
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/events']}>
      <EventsPage />
    </MemoryRouter>
  );

// Queue successive getDocs responses (call 1 = initial load, call 2 =
// next list page or a search response, …).
const queueResponses = (pages) => {
  let call = 0;
  vi.mocked(getDocs).mockImplementation(async () => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return makeSnapshot(page);
  });
};

// The constraints array of the n-th getDocs call (args[0] is the collection).
const nthQueryArgs = (n) => vi.mocked(getDocs).mock.calls[n - 1][0].args;

// Type into the search box and wait for the debounced (300 ms) server
// search to settle. The debounce runs on real timers, so this costs ~350
// ms per search test — acceptable for the suite.
const typeSearch = async (value) => {
  fireEvent.change(screen.getByPlaceholderText('Search events…'), {
    target: { value },
  });
  await waitFor(() =>
    expect(vi.mocked(getDocs).mock.calls.length).toBeGreaterThanOrEqual(2)
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.cb = null;
});

// ---------------------------------------------------------------------------
// issue #27 — upcoming-only default with a server-side date filter
// ---------------------------------------------------------------------------

describe('upcoming-only default view (issue #27)', () => {
  test('the default view applies where(date >= now) + orderBy(date asc) server-side', async () => {
    queueResponses([[], []]);
    renderPage();

    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(1));
    expect(nthQueryArgs(1)).toEqual([
      expect.anything(),
      { where: ['date', '>=', fakeNow] },
      { orderBy: ['date', 'asc'] },
      { limit: 20 },
    ]);
  });

  test('toggling "Show past events" re-queries with no date constraint, newest-posted first', async () => {
    const { page1, page2 } = buildAllDocs();
    queueResponses([page1, page1, page2]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2));
    expect(nthQueryArgs(2)).toEqual([
      expect.anything(),
      { orderBy: ['createdOn', 'desc'] },
      { limit: 20 },
    ]);
  });

  test('un-toggling returns to the server-side upcoming query', async () => {
    const { page1 } = buildAllDocs();
    queueResponses([page1, page1, page1]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);
    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2));
    fireEvent.click(toggle);
    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(3));

    expect(nthQueryArgs(3)).toEqual([
      expect.anything(),
      { where: ['date', '>=', fakeNow] },
      { orderBy: ['date', 'asc'] },
      { limit: 20 },
    ]);
  });

  test('Load more in the upcoming view passes startAfter on the last event date', async () => {
    const { page1, page2 } = buildAllDocs();
    queueResponses([page1, page2]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    fireEvent.click(screen.getByRole('button', { name: /load more events/i }));

    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(2));
    const lastDate = page1[page1.length - 1].data().date;
    expect(nthQueryArgs(2)).toContainEqual({ startAfter: lastDate });
  });
});

// ---------------------------------------------------------------------------
// issue #26 — collection-wide search via the server-side index
// ---------------------------------------------------------------------------

describe('server-side search over the searchIndex field (issue #26)', () => {
  test('the placeholder promises collection-wide search, and no scope hint is shown while the index query works', () => {
    queueResponses([[], []]);
    renderPage();

    const input = screen.getByPlaceholderText('Search events…');
    expect(input).toBeInTheDocument();
    // The index query is alive, so the loaded-window caveat is not shown
    // (it appears only in fallback mode — see below).
    expect(screen.queryByTestId('search-scope-hint')).not.toBeInTheDocument();
  });

  test('a search fires a debounced array-contains-any query — single-field, index-free', async () => {
    const { page1 } = buildAllDocs();
    // call 1 = initial listing load, call 2 = the search response.
    const searchHit = makeDoc('doc-11', {
      title: 'JazzNight',
      searchIndex: ['jazznight', 'jazz', 'night'],
    });
    queueResponses([page1, [searchHit]]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    // "Jazz" alone is one token → array-contains-any matches any doc whose
    // index contains it, collection-wide. No orderBy and no second
    // where clause: adding either would require a composite index.
    await typeSearch('Jazz');

    expect(nthQueryArgs(2)).toEqual([
      expect.anything(),
      { where: ['searchIndex', 'array-contains-any', ['jazz']] },
      { limit: 50 },
    ]);

    // The server hit replaces the listing.
    await waitFor(() => expect(screen.getByText('JazzNight')).toBeInTheDocument());
    expect(screen.getAllByTestId('event-title')).toHaveLength(1);
  });

  test('the search query is identical in both views (scoping is client-side)', async () => {
    const { page1 } = buildAllDocs();
    // call 1 = listing load, call 2 = upcoming-view search,
    // call 3 = past-view listing (the toggle re-fetches the listing),
    // call 4 = past-view search.
    queueResponses([page1, [], page1, []]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    // Upcoming view search (call 2).
    await typeSearch('Jazz');
    const upcomingQuery = nthQueryArgs(2);

    // The toggle re-fetches the listing (call 3) but must not re-fire the
    // search — the query carries no view-dependent constraint.
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(3));

    // "Jazz Night" tokenises to two tokens → the past-view search (call 4)
    // differs from the upcoming one only in the token list.
    fireEvent.change(screen.getByPlaceholderText('Search events…'), {
      target: { value: 'Jazz Night' },
    });
    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(4));
    const pastQuery = nthQueryArgs(4);

    // Same single-field shape in both views.
    expect(upcomingQuery).toEqual([
      expect.anything(),
      { where: ['searchIndex', 'array-contains-any', ['jazz']] },
      { limit: 50 },
    ]);
    expect(pastQuery).toEqual([
      expect.anything(),
      { where: ['searchIndex', 'array-contains-any', ['jazz', 'night']] },
      { limit: 50 },
    ]);
    // And the toggle itself spent no search query (call 3 was the listing).
    expect(nthQueryArgs(3)).toEqual([
      expect.anything(),
      { orderBy: ['createdOn', 'desc'] },
      { limit: 20 },
    ]);
  });

  test('past-dated hits are hidden in the upcoming view, shown in the past view (client-side scope)', async () => {
    const { page1 } = buildAllDocs();
    const pastHit = makeDoc('doc-1', {
      title: 'ZebraFest',
      searchIndex: ['zebrafest'],
      date: pastDate(),
    });
    // call 1 = listing load, call 2 = upcoming-view search (server returns
    // the past hit — the index query has no date constraint by design),
    // call 3 = past-view search.
    queueResponses([page1, [pastHit], [pastHit]]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    await typeSearch('ZebraFest');
    // The hit is dated in the past → filtered out of the upcoming view,
    // even though the server returned it.
    await waitFor(() =>
      expect(screen.queryAllByTestId('event-title')).toHaveLength(0)
    );

    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(getDocs).toHaveBeenCalledTimes(3));
    // Same hit, now visible in the past view.
    await waitFor(() => expect(screen.getByText('ZebraFest')).toBeInTheDocument());
  });

  test('search results sort soonest-first client-side (no server orderBy)', async () => {
    const { page1 } = buildAllDocs();
    // The server returns the hits in an arbitrary order (the query has no
    // orderBy); the page must sort them by date ascending.
    const laterHit = makeDoc('doc-11', {
      title: 'JazzNight June',
      searchIndex: ['jazznight'],
      date: futureDate(), // 2030-06-01
    });
    const soonerHit = makeDoc('doc-12', {
      title: 'JazzNight February',
      searchIndex: ['jazznight'],
      date: soonDate(), // 2030-02-01
    });
    queueResponses([page1, [laterHit, soonerHit]]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    await typeSearch('JazzNight');

    await waitFor(() => expect(screen.getAllByTestId('event-title')).toHaveLength(2));
    const titles = screen.getAllByTestId('event-title').map((el) => el.textContent);
    expect(titles).toEqual(['JazzNight February', 'JazzNight June']);
  });

  test('when the index query fails (transient error), search falls back to loaded-window filtering with the #22 hint', async () => {
    const { page1 } = buildAllDocs();
    // call 1 = listing load; call 2 (the search) rejects.
    vi.mocked(getDocs)
      .mockResolvedValueOnce(makeSnapshot(page1))
      .mockRejectedValueOnce(new Error('firestore unavailable'));
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    // JazzNight is in the loaded window (doc-11 on page 1).
    await typeSearch('JazzNight');

    // Fallback: the client-side filter still finds the loaded doc…
    await waitFor(() => expect(screen.getByText('JazzNight')).toBeInTheDocument());
    expect(screen.getAllByTestId('event-title')).toHaveLength(1);
    // …and the honest #22 scope hint is back, telling users to Load more.
    expect(screen.getByTestId('search-scope-hint')).toHaveTextContent(
      /loaded so far/i
    );
    expect(screen.getByTestId('search-scope-hint')).toHaveTextContent(
      /load more/i
    );
  });

  test('in fallback mode a term that only exists on an unloaded page returns nothing, with the hint shown (issue #22 contract)', async () => {
    const { page1 } = buildAllDocs();
    vi.mocked(getDocs)
      .mockResolvedValueOnce(makeSnapshot(page1))
      .mockRejectedValueOnce(new Error('firestore unavailable'));
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    // ZebraFest only exists on doc-1 (page 2, not loaded).
    await typeSearch('ZebraFest');

    await waitFor(() =>
      expect(screen.queryAllByTestId('event-title')).toHaveLength(0)
    );
    expect(screen.getByTestId('search-scope-hint')).toHaveTextContent(
      /loaded so far/i
    );
  });

  test('after Load more in fallback mode, a page-2 term becomes matchable (issue #22 contract)', async () => {
    const { page1, page2 } = buildAllDocs();
    // call 1 = listing load, call 2 = search (rejects → fallback),
    // call 3 = Load more.
    vi.mocked(getDocs)
      .mockResolvedValueOnce(makeSnapshot(page1))
      .mockRejectedValueOnce(new Error('firestore unavailable'))
      .mockResolvedValueOnce(makeSnapshot(page2));
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    await typeSearch('ZebraFest');
    await waitFor(() =>
      expect(screen.queryAllByTestId('event-title')).toHaveLength(0)
    );

    // Load page 2.
    fireEvent.click(screen.getByRole('button', { name: /load more events/i }));

    // The now-loaded page-2 doc is found by the same query.
    await waitFor(() =>
      expect(screen.getByText('ZebraFest')).toBeInTheDocument()
    );
    expect(screen.getAllByTestId('event-title')).toHaveLength(1);
  });

  test('Clear search leaves search mode and restores the listing without re-fetching', async () => {
    const { page1 } = buildAllDocs();
    const searchHit = makeDoc('doc-11', {
      title: 'JazzNight',
      searchIndex: ['jazznight'],
    });
    vi.mocked(getDocs)
      .mockResolvedValueOnce(makeSnapshot(page1))
      .mockResolvedValueOnce(makeSnapshot([searchHit]));
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    await typeSearch('Jazz');
    await waitFor(() => expect(screen.getByText('JazzNight')).toBeInTheDocument());
    expect(screen.getAllByTestId('event-title')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

    // The previously loaded listing is restored from state — no extra
    // query is spent just because the search cleared.
    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );
    expect(getDocs).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  test('the Load more button is hidden while a search is active (search is a one-shot result set)', async () => {
    const { page1 } = buildAllDocs();
    const searchHit = makeDoc('doc-11', {
      title: 'JazzNight',
      searchIndex: ['jazznight'],
    });
    vi.mocked(getDocs)
      .mockResolvedValueOnce(makeSnapshot(page1))
      .mockResolvedValueOnce(makeSnapshot([searchHit]));
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );
    expect(screen.getByRole('button', { name: /load more events/i })).toBeInTheDocument();

    await typeSearch('Jazz');
    await waitFor(() => expect(screen.getByText('JazzNight')).toBeInTheDocument());

    expect(
      screen.queryByRole('button', { name: /load more events/i })
    ).not.toBeInTheDocument();
  });

  test('an empty query shows the full listing (no search active)', async () => {
    const { page1 } = buildAllDocs();
    queueResponses([page1]);
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByTestId('event-title')).toHaveLength(20)
    );

    const input = screen.getByPlaceholderText('Search events…');
    fireEvent.change(input, { target: { value: '' } });
    // Only the initial listing query was ever issued.
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('event-title')).toHaveLength(20);
  });
});
