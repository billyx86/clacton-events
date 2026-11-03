import {
  buildFeed,
  dateToMillis,
  locationLabel,
  safeImageUrl,
  toFeedEntry,
} from './feedShaper.js';

describe('locationLabel', () => {
  test('returns a plain string location trimmed', () => {
    expect(locationLabel('  Clacton Pier ')).toBe('Clacton Pier');
  });

  test('returns the label of a Places-autocomplete object', () => {
    expect(
      locationLabel({ label: 'Seafront, Clacton', lat: 51.79, lng: 1.15 })
    ).toBe('Seafront, Clacton');
  });

  test('returns empty string for missing or malformed locations', () => {
    expect(locationLabel(null)).toBe('');
    expect(locationLabel(undefined)).toBe('');
    expect(locationLabel('')).toBe('');
    expect(locationLabel({})).toBe('');
    expect(locationLabel({ label: 42 })).toBe('');
    expect(locationLabel(42)).toBe('');
  });
});

describe('dateToMillis', () => {
  test('handles a Firestore Timestamp (toDate)', () => {
    const ts = { toDate: () => new Date('2030-06-01T12:00:00Z') };
    expect(dateToMillis(ts)).toBe(new Date('2030-06-01T12:00:00Z').getTime());
  });

  test('handles a { seconds } Firestore-style object', () => {
    const seconds = Math.floor(
      new Date('2030-06-01T12:00:00Z').getTime() / 1000
    );
    expect(dateToMillis({ seconds })).toBe(seconds * 1000);
  });

  test('handles plain Date and ISO string values', () => {
    expect(dateToMillis(new Date('2030-06-01T00:00:00Z'))).toBe(
      new Date('2030-06-01T00:00:00Z').getTime()
    );
    expect(dateToMillis('2030-06-01T00:00:00Z')).toBe(
      new Date('2030-06-01T00:00:00Z').getTime()
    );
  });

  test('returns null for missing or unparseable values', () => {
    expect(dateToMillis(null)).toBeNull();
    expect(dateToMillis(undefined)).toBeNull();
    expect(dateToMillis('not a date')).toBeNull();
    expect(dateToMillis({ toDate: () => new Date('nope') })).toBeNull();
  });
});

describe('safeImageUrl', () => {
  test('passes through absolute http and https URLs', () => {
    expect(safeImageUrl('http://example.com/a.jpg')).toBe(
      'http://example.com/a.jpg'
    );
    expect(
      safeImageUrl('https://firebasestorage.googleapis.com/x.png')
    ).toBe('https://firebasestorage.googleapis.com/x.png');
  });

  test('rejects javascript:, data: and vbscript: payloads (stored-XSS)', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('');
    expect(safeImageUrl('data:text/html,<script>1</script>')).toBe('');
    expect(safeImageUrl('vbscript:msgbox(1)')).toBe('');
  });

  test('rejects relative paths and unparseable values', () => {
    expect(safeImageUrl('/images/a.jpg')).toBe('');
    expect(safeImageUrl('images a.jpg')).toBe('');
    expect(safeImageUrl('https://')).toBe('');
  });

  test('returns empty string for missing/blank values', () => {
    expect(safeImageUrl('')).toBe('');
    expect(safeImageUrl('   ')).toBe('');
    expect(safeImageUrl(null)).toBe('');
    expect(safeImageUrl(undefined)).toBe('');
  });
});

describe('toFeedEntry', () => {
  const origin = 'https://clacton-events.example.com';

  test('maps a full document to the stable feed entry shape', () => {
    const entry = toFeedEntry(
      {
        id: 'doc-1',
        data: () => ({
          content: 'ZebraFest',
          date: new Date('2030-06-01T12:00:00Z'),
          location: { label: 'Clacton Pier' },
          imageUrl: 'https://cdn.example.com/zebra.jpg',
          // Fields outside the contract must not leak into the feed.
          longDescription: 'secretly long',
          websiteUrl: 'https://elsewhere.example.com',
          searchIndex: ['zebrafest'],
        }),
      },
      origin
    );

    expect(entry).toEqual({
      id: 'doc-1',
      title: 'ZebraFest',
      date: '2030-06-01T12:00:00.000Z',
      location: 'Clacton Pier',
      imageUrl: 'https://cdn.example.com/zebra.jpg',
      url: `${origin}/events/doc-1`,
    });
    // Exactly the stable contract — no extra fields.
    expect(Object.keys(entry).sort()).toEqual(
      ['date', 'id', 'imageUrl', 'location', 'title', 'url'].sort()
    );
  });

  test('builds absolute links, stripping a trailing slash from the origin and encoding the doc id', () => {
    const entry = toFeedEntry(
      { id: 'a b/c', data: () => ({ content: 'T', date: null, location: null, imageUrl: '' }) },
      `${origin}/`
    );
    expect(entry.url).toBe(`${origin}/events/a%20b%2Fc`);
  });

  test('leaves url empty when no site origin is configured', () => {
    const entry = toFeedEntry(
      { id: 'doc-1', data: () => ({ content: 'T' }) },
      ''
    );
    expect(entry.url).toBe('');
  });

  test('emits null date for missing/invalid dates', () => {
    expect(
      toFeedEntry({ id: '1', data: () => ({ content: 'T' }) }, origin).date
    ).toBeNull();
    expect(
      toFeedEntry(
        { id: '2', data: () => ({ content: 'T', date: 'garbage' }) },
        origin
      ).date
    ).toBeNull();
  });

  test('returns null for documents without a title (not publishable)', () => {
    expect(
      toFeedEntry({ id: '1', data: () => ({ content: '' }) }, origin)
    ).toBeNull();
    expect(toFeedEntry({ id: '1', data: () => ({ content: '   ' }) }, origin)).toBeNull();
    expect(toFeedEntry({ id: '1', data: () => ({}) }, origin)).toBeNull();
  });
});

describe('buildFeed', () => {
  const origin = 'https://clacton-events.example.com';
  const fixedNow = new Date('2026-11-03T02:00:00Z');

  const doc = (id, data) => ({ id, data: () => data });

  test('sorts soonest-first and stamps generatedAt from the injected clock', () => {
    const feed = buildFeed(
      [
        doc('c', { content: 'C', date: new Date('2030-09-01T00:00:00Z') }),
        doc('a', { content: 'A', date: new Date('2030-06-01T00:00:00Z') }),
        doc('b', { content: 'B', date: new Date('2030-07-01T00:00:00Z') }),
      ],
      { siteOrigin: origin, now: fixedNow }
    );

    expect(feed.generatedAt).toBe('2026-11-03T02:00:00.000Z');
    expect(feed.events.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  test('sorts undated events last, stably among themselves', () => {
    const feed = buildFeed(
      [
        doc('x1', { content: 'X1' }),
        doc('dated', { content: 'D', date: new Date('2030-06-01T00:00:00Z') }),
        doc('x2', { content: 'X2', date: 'garbage' }),
      ],
      { siteOrigin: origin, now: fixedNow }
    );
    expect(feed.events.map((e) => e.id)).toEqual(['dated', 'x1', 'x2']);
  });

  test('drops unpublishable documents (no title)', () => {
    const feed = buildFeed(
      [
        doc('ok', { content: 'Kept', date: new Date('2030-06-01T00:00:00Z') }),
        doc('bad', { content: '' }),
      ],
      { siteOrigin: origin, now: fixedNow }
    );
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0].id).toBe('ok');
  });

  test('handles an empty input gracefully', () => {
    const feed = buildFeed([], { siteOrigin: origin, now: fixedNow });
    expect(feed).toEqual({
      generatedAt: '2026-11-03T02:00:00.000Z',
      events: [],
    });
  });

  test('accepts { seconds } dates from Firestore-style docs', () => {
    const seconds = Math.floor(new Date('2030-06-01T00:00:00Z').getTime() / 1000);
    const feed = buildFeed(
      [doc('s', { content: 'S', date: { seconds } })],
      { siteOrigin: origin, now: fixedNow }
    );
    expect(feed.events[0].date).toBe('2030-06-01T00:00:00.000Z');
  });
});
