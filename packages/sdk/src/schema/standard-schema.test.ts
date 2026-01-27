import { describe, expect, test } from 'bun:test';
import type {
  ExtractionWarning,
  ExtractionWarningCode,
  StandardSchemaExtractionOutput,
} from './standard-schema';

describe('standard-schema warnings', () => {
  describe('ExtractionWarning type', () => {
    test('valid warning codes', () => {
      const validCodes: ExtractionWarningCode[] = [
        'SCHEMA_FAILED',
        'TYPEBOX_FAILED',
        'PARSE_FAILED',
        'CLEANUP_FAILED',
        'TSCONFIG_INVALID',
      ];

      for (const code of validCodes) {
        const warning: ExtractionWarning = {
          code,
          message: 'test message',
        };
        expect(warning.code).toBe(code);
      }
    });

    test('warning with exportName', () => {
      const warning: ExtractionWarning = {
        code: 'SCHEMA_FAILED',
        message: 'extraction failed',
        exportName: 'UserSchema',
      };

      expect(warning.exportName).toBe('UserSchema');
    });

    test('warning without exportName', () => {
      const warning: ExtractionWarning = {
        code: 'CLEANUP_FAILED',
        message: 'could not delete temp file',
      };

      expect(warning.exportName).toBeUndefined();
    });
  });

  describe('StandardSchemaExtractionOutput', () => {
    test('output includes warnings array', () => {
      const output: StandardSchemaExtractionOutput = {
        schemas: new Map(),
        errors: [],
        warnings: [],
      };

      expect(output.warnings).toEqual([]);
    });

    test('output with populated warnings', () => {
      const warnings: ExtractionWarning[] = [
        { code: 'SCHEMA_FAILED', message: 'err1', exportName: 'Schema1' },
        { code: 'TYPEBOX_FAILED', message: 'err2', exportName: 'Schema2' },
      ];

      const output: StandardSchemaExtractionOutput = {
        schemas: new Map(),
        errors: [],
        warnings,
      };

      expect(output.warnings).toHaveLength(2);
      expect(output.warnings[0].code).toBe('SCHEMA_FAILED');
      expect(output.warnings[1].code).toBe('TYPEBOX_FAILED');
    });

    test('warnings and errors can coexist', () => {
      const output: StandardSchemaExtractionOutput = {
        schemas: new Map(),
        errors: ['fatal error'],
        warnings: [{ code: 'SCHEMA_FAILED', message: 'non-fatal' }],
      };

      expect(output.errors).toHaveLength(1);
      expect(output.warnings).toHaveLength(1);
    });
  });
});
