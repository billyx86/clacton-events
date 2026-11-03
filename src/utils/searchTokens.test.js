/**
 * Unit tests for the denormalised search-index helpers (issue #26).
 */
import {
  MAX_INDEX_TOKENS,
  MAX_QUERY_TOKENS,
  buildSearchIndex,
  tokenizeSearchQuery,
  tokenizeText,
} from './searchTokens';

describe('tokenizeText', () => {
  test('lowercases and splits on punctuation and whitespace', () => {
    expect(tokenizeText('Seafront Market 2026!')).toEqual([
      'seafront',
      'market',
      '2026',
    ]);
  });

  test('splits on dashes, slashes, and emoji', () => {
    expect(tokenizeText('clacton-on-sea / pier 🎉 night')).toEqual([
      'clacton',
      'on',
      'sea',
      'pier',
      'night',
    ]);
  });

  test('drops single-character tokens', () => {
    expect(tokenizeText('a b the c i seafront')).toEqual(['the', 'seafront']);
  });

  test('de-duplicates while preserving first-seen order', () => {
    expect(tokenizeText('jazz Jazz jazz-night jazz night')).toEqual([
      'jazz',
      'night',
    ]);
  });

  test('returns [] for missing or empty input', () => {
    expect(tokenizeText(undefined)).toEqual([]);
    expect(tokenizeText(null)).toEqual([]);
    expect(tokenizeText('')).toEqual([]);
    expect(tokenizeText('!!!')).toEqual([]);
  });
});

describe('buildSearchIndex', () => {
  test('indexes title, both descriptions, and a string location', () => {
    const index = buildSearchIndex({
      content: 'Jazz Night',
      shortDescription: 'Live band on the pier',
      longDescription: 'Doors at eight, bring a coat',
      location: 'Clacton Pier',
    });
    expect(index).toEqual([
      'jazz',
      'night',
      'live',
      'band',
      'on',
      'the',
      'pier',
      'doors',
      'at',
      'eight',
      'bring',
      'coat',
      'clacton', // location: "Clacton Pier" — pier already indexed
    ]);
  });

  test('indexes the label of a {label} location object', () => {
    const index = buildSearchIndex({
      content: 'Flea Market',
      shortDescription: '',
      longDescription: '',
      location: { label: 'Clacton Town Hall' },
    });
    expect(index).toEqual(['flea', 'market', 'clacton', 'town', 'hall']);
  });

  test('tolerates missing fields and null location', () => {
    expect(buildSearchIndex({ content: 'Solo' })).toEqual(['solo']);
    expect(buildSearchIndex({})).toEqual([]);
    expect(buildSearchIndex({ content: 'X', location: null })).toEqual([]);
  });

  test('de-duplicates across fields', () => {
    const index = buildSearchIndex({
      content: 'Jazz Night',
      shortDescription: 'jazz all night',
      longDescription: 'JAZZ',
    });
    expect(index).toEqual(['jazz', 'night', 'all']);
  });

  test('caps the index at MAX_INDEX_TOKENS', () => {
    const manyWords = Array.from({ length: 300 }, (_, i) => `word${i}`)
      .join(' ');
    const index = buildSearchIndex({ content: manyWords });
    expect(index).toHaveLength(MAX_INDEX_TOKENS);
    // First-seen order is kept.
    expect(index[0]).toBe('word0');
    expect(index[MAX_INDEX_TOKENS - 1]).toBe(`word${MAX_INDEX_TOKENS - 1}`);
  });
});

describe('tokenizeSearchQuery', () => {
  test('returns [] for an empty query (no search active)', () => {
    expect(tokenizeSearchQuery('')).toEqual([]);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
    expect(tokenizeSearchQuery(undefined)).toEqual([]);
  });

  test('tokenises a phrase into its words', () => {
    expect(tokenizeSearchQuery('Jazz Night')).toEqual(['jazz', 'night']);
  });

  test('caps the operand at MAX_QUERY_TOKENS (Firestore limit is 50)', () => {
    const manyWords = Array.from({ length: 80 }, (_, i) => `tok${i}`)
      .join(' ');
    const tokens = tokenizeSearchQuery(manyWords);
    expect(tokens).toHaveLength(MAX_QUERY_TOKENS);
    expect(MAX_QUERY_TOKENS).toBeLessThanOrEqual(50);
  });
});
