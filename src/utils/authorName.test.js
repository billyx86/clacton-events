import { resolveAuthorName } from './authorName';

describe('resolveAuthorName', () => {
    test('prefers the users/<email> doc name (source of truth)', () => {
        expect(resolveAuthorName({ name: 'Billy King' }, { displayName: 'B', email: 'b@x.co' })).toBe('Billy King');
    });

    test('falls back to the auth displayName when the doc is missing', () => {
        expect(resolveAuthorName(null, { displayName: 'Billy King', email: 'b@x.co' })).toBe('Billy King');
    });

    test('falls back to the local part of the email', () => {
        expect(resolveAuthorName(null, { displayName: '', email: 'billy.king@clacton.example' })).toBe('billy.king');
    });

    test('falls back to "Anonymous" with no usable user', () => {
        expect(resolveAuthorName(null, null)).toBe('Anonymous');
        expect(resolveAuthorName(undefined, undefined)).toBe('Anonymous');
    });

    test('never returns an empty string', () => {
        expect(resolveAuthorName(undefined, undefined)).not.toBe('');
        expect(resolveAuthorName({}, null)).toBe('Anonymous');
    });

    test('ignores a blank doc name and uses the next source', () => {
        expect(resolveAuthorName({ name: '   ' }, { displayName: 'Billy', email: 'b@x.co' })).toBe('Billy');
    });

    test('ignores a non-string doc name', () => {
        expect(resolveAuthorName({ name: 12345 }, { email: 'b@x.co' })).toBe('b');
    });

    test('handles a displayName present but blank, email still works', () => {
        expect(resolveAuthorName(null, { displayName: '  ', email: 'a@b.c' })).toBe('a');
    });

    test('does not crash on weird email shapes', () => {
        expect(resolveAuthorName(null, { email: '@no-local.co' })).toBe('@no-local.co');
        expect(resolveAuthorName(null, { email: 'no-at-sign' })).toBe('no-at-sign');
    });
});
