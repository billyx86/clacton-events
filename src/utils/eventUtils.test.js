/**
 * Unit tests for the shared event helpers.
 *
 * These run under CRA's built-in Jest via `npm test` (CI mode).
 */
import {
    toEvent,
    isEventUpcoming,
    filterEventsByQuery,
    sortEventsByRecency,
    getLocationLabel,
    formatEventDate,
} from './eventUtils';

describe('toEvent', () => {
    test('document ID wins over the legacy numeric id counter', () => {
        const doc = { id: 'abc123', data: () => ({ id: 7, content: 'X' }) };
        expect(toEvent(doc).id).toBe('abc123');
    });

    test('falls back to the numeric id when the doc ID is unusable', () => {
        const doc = { id: '', data: () => ({ id: 7 }) };
        expect(toEvent(doc).id).toBe(7);
    });

    test('keeps the numeric id as legacyId for sorting', () => {
        const doc = { id: 'abc123', data: () => ({ id: 7 }) };
        expect(toEvent(doc).legacyId).toBe(7);
    });

    test('legacyId is null when the counter field is missing', () => {
        const doc = { id: 'abc123', data: () => ({}) };
        expect(toEvent(doc).legacyId).toBeNull();
    });
});

describe('isEventUpcoming', () => {
    const now = new Date('2026-08-16T03:00:00Z');

    test('accepts a Firestore-style timestamp object', () => {
        const ts = { seconds: Math.floor(now.getTime() / 1000) + 3600 };
        expect(isEventUpcoming(ts, now)).toBe(true);
    });

    test('accepts a JavaScript Date', () => {
        expect(isEventUpcoming(new Date(now.getTime() + 60000), now)).toBe(true);
    });

    test('rejects past dates', () => {
        expect(isEventUpcoming(new Date(now.getTime() - 60000), now)).toBe(false);
    });

    test('never throws on missing or malformed dates', () => {
        expect(isEventUpcoming(undefined, now)).toBe(false);
        expect(isEventUpcoming(null, now)).toBe(false);
        expect(isEventUpcoming({ seconds: 'nope' }, now)).toBe(false);
    });
});

describe('filterEventsByQuery', () => {
    const events = [
        { id: '1', content: 'Seafront Market', shortDescription: 'Fruit and veg', longDescription: 'A lovely market by the sea' },
        { id: '2', content: 'Jazz Night', shortDescription: '' }, // missing longDescription
    ];

    test('empty query returns all events', () => {
        expect(filterEventsByQuery(events, '')).toHaveLength(2);
    });

    test('matches on title case-insensitively', () => {
        expect(filterEventsByQuery(events, 'seafront')).toHaveLength(1);
    });

    test('matches on short and long descriptions', () => {
        expect(filterEventsByQuery(events, 'fruit')).toHaveLength(1);
        expect(filterEventsByQuery(events, 'lovely market')).toHaveLength(1);
    });

    test('no crash when content or descriptions are missing', () => {
        expect(() => filterEventsByQuery([{ id: 'x' }], 'anything')).not.toThrow();
    });
});

describe('sortEventsByRecency', () => {
    const a = { id: 'a', createdOn: { seconds: 100 }, legacyId: 1 };
    const b = { id: 'b', createdOn: { seconds: 200 }, legacyId: 2 };

    test('newest createdOn first', () => {
        expect(sortEventsByRecency([a, b]).map(e => e.id)).toEqual(['b', 'a']);
    });

    test('does not mutate the input array', () => {
        const input = [a, b];
        sortEventsByRecency(input);
        expect(input.map(e => e.id)).toEqual(['a', 'b']);
    });

    test('falls back to the legacy counter when createdOn is missing', () => {
        const x = { id: 'x', createdOn: null, legacyId: 1 };
        const y = { id: 'y', createdOn: null, legacyId: 2 };
        expect(sortEventsByRecency([x, y]).map(e => e.id)).toEqual(['y', 'x']);
    });

    test('handles null/missing sort fields without throwing', () => {
        expect(() => sortEventsByRecency([{ id: 'n' }])).not.toThrow();
    });
});

describe('getLocationLabel', () => {
    test('returns the label of a location object', () => {
        expect(getLocationLabel({ label: 'Clacton Pier' })).toBe('Clacton Pier');
    });

    test('returns a plain string location as-is', () => {
        expect(getLocationLabel('Main Street')).toBe('Main Street');
    });

    test('returns empty string for missing location', () => {
        expect(getLocationLabel(undefined)).toBe('');
        expect(getLocationLabel(null)).toBe('');
    });
});

describe('formatEventDate', () => {
    test('formats a Firestore-style timestamp', () => {
        const d = new Date('2026-09-01T10:30:00Z');
        const ts = { seconds: Math.floor(d.getTime() / 1000) };
        const out = formatEventDate(ts);
        // Assert against *local* components (en-GB locale, local timezone)
        // so the test passes regardless of CI timezone.
        const pad = (n) => String(n).padStart(2, '0');
        expect(out).toContain(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
        expect(out).toContain(String(d.getFullYear()));
    });

    test('returns empty string for missing date', () => {
        expect(formatEventDate(undefined)).toBe('');
        expect(formatEventDate(null)).toBe('');
    });
});
