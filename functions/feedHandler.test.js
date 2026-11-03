// Handler-level tests for the public feed (#28). We mock only the
// firebase-admin Firestore surface (getFirestore + Timestamp) so the
// request handler runs against a fake database, and we never import the
// firebase-functions framework (index.js stays out of the unit-test path).

// vi.hoisted keeps the mutable fake above the hoisted vi.mock factory.
const { state } = vi.hoisted(() => ({
  state: {
    // Docs the fake snapshot returns.
    docs: [],
    // When truthy, the fake get() rejects with this message (to simulate a
    // Firestore failure and exercise the handler's 500 path).
    failWith: null,
    // Recorded query chain (constraints in call order).
    constraints: [],
    // Collection name the query was built against.
    collectionName: null,
  },
}));

vi.mock('firebase-admin/firestore', () => {
  const fakeDb = {
    collection(name) {
      state.collectionName = name;
      const ref = {
        where(field, op, value) {
          state.constraints.push({ kind: 'where', field, op, value });
          return ref;
        },
        orderBy(field, dir) {
          state.constraints.push({ kind: 'orderBy', field, dir });
          return ref;
        },
        limit(n) {
          state.constraints.push({ kind: 'limit', n });
          return ref;
        },
        get() {
          if (state.failWith) {
            return Promise.reject(new Error(state.failWith));
          }
          return Promise.resolve({ docs: state.docs });
        },
      };
      return ref;
    },
  };
  return {
    getFirestore: () => fakeDb,
    Timestamp: { now: () => ({ _ts: 'now' }) },
  };
});

import {
  buildFeedResponse,
  handleFeedRequest,
  MAX_FEED_EVENTS,
} from './feedHandler.js';

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const upcomingDoc = (id, dateIso) => ({
  id,
  data: () => ({
    content: `Event ${id}`,
    date: new Date(dateIso),
    location: 'Clacton Pier',
    imageUrl: '',
  }),
});

beforeEach(() => {
  state.docs = [];
  state.failWith = null;
  state.constraints = [];
  state.collectionName = null;
  process.env.EVENTS_SITE_ORIGIN = 'https://clacton-events.example.com';
});

describe('buildFeedResponse', () => {
  test('queries the events collection with a single-field, index-free where+orderBy on date', async () => {
    state.docs = [upcomingDoc('1', '2030-06-01T00:00:00Z')];
    await buildFeedResponse();

    expect(state.collectionName).toBe('events');
    // Exactly one where (range on date) and one orderBy — and both on the
    // SAME field, so Firestore needs no composite index.
    const wheres = state.constraints.filter((c) => c.kind === 'where');
    const orderBys = state.constraints.filter((c) => c.kind === 'orderBy');
    expect(wheres).toHaveLength(1);
    expect(orderBys).toHaveLength(1);
    expect(wheres[0]).toEqual({
      kind: 'where',
      field: 'date',
      op: '>=',
      value: { _ts: 'now' },
    });
    expect(orderBys[0]).toEqual({ kind: 'orderBy', field: 'date', dir: 'asc' });
    // Same-field pairing is what keeps it index-free.
    expect(wheres[0].field).toBe(orderBys[0].field);
    // Bounded result set.
    const limit = state.constraints.find((c) => c.kind === 'limit');
    expect(limit).toEqual({ kind: 'limit', n: MAX_FEED_EVENTS });
  });

  test('shapes docs into the stable feed contract and uses the env origin for url', async () => {
    state.docs = [
      upcomingDoc('2', '2030-07-01T00:00:00Z'),
      upcomingDoc('1', '2030-06-01T00:00:00Z'),
    ];
    const feed = await buildFeedResponse();

    expect(feed.events.map((e) => e.id)).toEqual(['1', '2']);
    expect(feed.events[0]).toEqual({
      id: '1',
      title: 'Event 1',
      date: '2030-06-01T00:00:00.000Z',
      location: 'Clacton Pier',
      imageUrl: '',
      url: 'https://clacton-events.example.com/events/1',
    });
  });

  test('honours an explicit siteOrigin over the env var', async () => {
    state.docs = [upcomingDoc('9', '2030-06-01T00:00:00Z')];
    const feed = await buildFeedResponse({
      siteOrigin: 'https://override.example.org',
    });
    expect(feed.events[0].url).toBe('https://override.example.org/events/9');
  });

  test('returns an empty feed when there are no upcoming events', async () => {
    state.docs = [];
    const feed = await buildFeedResponse();
    expect(feed.events).toEqual([]);
  });
});

describe('handleFeedRequest', () => {
  test('GET returns 200 JSON with CORS + cache headers and the feed body', async () => {
    state.docs = [upcomingDoc('1', '2030-06-01T00:00:00Z')];
    const res = makeRes();
    await handleFeedRequest({ method: 'GET' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Cache-Control']).toBe('public, max-age=300');
    expect(res.headers['Content-Type']).toBe(
      'application/json; charset=utf-8'
    );
    const parsed = JSON.parse(res.body);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].id).toBe('1');
  });

  test('OPTIONS preflight returns 204 with allow-methods', async () => {
    const res = makeRes();
    await handleFeedRequest({ method: 'OPTIONS' }, res);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
  });

  test('non-GET methods return 405 with an Allow header', async () => {
    const res = makeRes();
    await handleFeedRequest({ method: 'POST' }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, OPTIONS');
    expect(JSON.parse(res.body).error).toMatch(/method not allowed/i);
  });

  test('a Firestore failure is surfaced as a 500 with a JSON error', async () => {
    state.failWith = 'boom';
    const res = makeRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleFeedRequest({ method: 'GET' }, res);
    expect(res.statusCode).toBe(500);
    expect(res.headers['Content-Type']).toBe(
      'application/json; charset=utf-8'
    );
    expect(JSON.parse(res.body).error).toMatch(/failed to build/i);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
