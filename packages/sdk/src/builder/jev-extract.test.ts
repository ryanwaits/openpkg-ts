import { describe, expect, test } from 'bun:test';
import type { EvaluateFn } from '../core/decisions';
import type { Diagnostic } from '../types';
import { calibrateDiagnostics, selectFollowExternal } from './jev-extract';

describe('selectFollowExternal', () => {
  test('follows packages scored essential', async () => {
    const evaluate: EvaluateFn = async () => ({
      answers: { t0: { score: 2 } },
      providerMetadata: { typesafe: { confidence: { t0: 1 } } },
    });
    const follow = await selectFollowExternal(
      [{ typeName: 'Widget', package: 'tiny-ext' }],
      evaluate,
    );
    expect(follow).toEqual(['tiny-ext']);
  });

  test('stubs packages scored opaque', async () => {
    const evaluate: EvaluateFn = async () => ({
      answers: { t0: { score: 0 } },
      providerMetadata: { typesafe: { confidence: { t0: 1 } } },
    });
    const follow = await selectFollowExternal(
      [{ typeName: 'Widget', package: 'tiny-ext' }],
      evaluate,
    );
    expect(follow).toEqual([]);
  });
});

describe('calibrateDiagnostics', () => {
  test('overrides severity when confident', async () => {
    const diagnostics: Diagnostic[] = [
      { message: 'Forgotten export: Foo', severity: 'warning', code: 'FORGOTTEN_EXPORT' },
    ];
    const evaluate: EvaluateFn = async () => ({
      answers: { d0: { choice: 'info', probabilities: { error: 0, warning: 0, info: 1 } } },
      providerMetadata: { typesafe: { confidence: { d0: 0.9 } } },
    });
    await calibrateDiagnostics(diagnostics, evaluate);
    expect(diagnostics[0].severity).toBe('info');
  });

  test('keeps original severity when confidence is low', async () => {
    const diagnostics: Diagnostic[] = [
      { message: 'Forgotten export: Foo', severity: 'warning', code: 'FORGOTTEN_EXPORT' },
    ];
    const evaluate: EvaluateFn = async () => ({
      answers: { d0: { choice: 'error', probabilities: { error: 0.4, warning: 0.3, info: 0.3 } } },
      providerMetadata: { typesafe: { confidence: { d0: 0.2 } } },
    });
    await calibrateDiagnostics(diagnostics, evaluate);
    expect(diagnostics[0].severity).toBe('warning');
  });
});
