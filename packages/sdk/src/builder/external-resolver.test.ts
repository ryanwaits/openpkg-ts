import { describe, expect, test } from 'bun:test';
import { matchesExternalPattern } from './external-resolver';

describe('matchesExternalPattern', () => {
  test('returns false when include is empty', () => {
    expect(matchesExternalPattern('lodash', [])).toBe(false);
    expect(matchesExternalPattern('lodash', undefined)).toBe(false);
  });

  test('matches wildcard *', () => {
    expect(matchesExternalPattern('lodash', ['*'])).toBe(true);
    expect(matchesExternalPattern('react', ['*'])).toBe(true);
    expect(matchesExternalPattern('@org/pkg', ['*'])).toBe(true);
  });

  test('matches exact package name', () => {
    expect(matchesExternalPattern('lodash', ['lodash'])).toBe(true);
    expect(matchesExternalPattern('lodash', ['react'])).toBe(false);
  });

  test('matches scoped packages with glob', () => {
    expect(matchesExternalPattern('@org/pkg', ['@org/*'])).toBe(true);
    expect(matchesExternalPattern('@org/other', ['@org/*'])).toBe(true);
    expect(matchesExternalPattern('@other/pkg', ['@org/*'])).toBe(false);
  });

  test('matches multiple patterns', () => {
    expect(matchesExternalPattern('lodash', ['react', 'lodash'])).toBe(true);
    expect(matchesExternalPattern('vue', ['react', 'lodash'])).toBe(false);
  });

  test('respects exclude patterns', () => {
    expect(matchesExternalPattern('react', ['*'], ['react'])).toBe(false);
    expect(matchesExternalPattern('react-dom', ['*'], ['react'])).toBe(true);
    expect(matchesExternalPattern('react-dom', ['*'], ['react*'])).toBe(false);
  });

  test('exclude takes precedence over include', () => {
    expect(matchesExternalPattern('lodash', ['lodash'], ['lodash'])).toBe(false);
  });

  test('handles glob patterns', () => {
    expect(matchesExternalPattern('lodash-es', ['lodash*'])).toBe(true);
    expect(matchesExternalPattern('lodash', ['lodash*'])).toBe(true);
    expect(matchesExternalPattern('underscore', ['lodash*'])).toBe(false);
  });
});
