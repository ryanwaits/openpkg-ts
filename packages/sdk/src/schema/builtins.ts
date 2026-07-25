import type { SpecSchema } from '@openpkg-ts/spec';

/** Object-shaped SpecSchema (excludes the string shorthand) — spreadable. */
export type BuiltinSchema = Extract<SpecSchema, object>;

/**
 * Structural JSON Schema approximations for JS/TS built-in types.
 * Used when serializing references to lib types (which are never registered
 * in a spec's types[]) and by adapters mapping refs for external consumers.
 */
export const BUILTIN_TYPE_SCHEMAS: Record<string, BuiltinSchema> = {
  Array: { type: 'array' },
  ReadonlyArray: { type: 'array' },
  Date: { type: 'string', format: 'date-time' },
  RegExp: { type: 'object' },
  Error: { type: 'object' },
  Promise: { type: 'object' },
  Map: { type: 'object' },
  Set: { type: 'object' },
  WeakMap: { type: 'object' },
  WeakSet: { type: 'object' },
  Function: { type: 'object' },
  ArrayBuffer: { type: 'string', format: 'binary' },
  ArrayBufferLike: { type: 'string', format: 'binary' },
  SharedArrayBuffer: { type: 'string', format: 'binary' },
  DataView: { type: 'string', format: 'binary' },
  Uint8Array: { type: 'string', format: 'byte' },
  Uint16Array: { type: 'string', format: 'byte' },
  Uint32Array: { type: 'string', format: 'byte' },
  Int8Array: { type: 'string', format: 'byte' },
  Int16Array: { type: 'string', format: 'byte' },
  Int32Array: { type: 'string', format: 'byte' },
  Float32Array: { type: 'string', format: 'byte' },
  Float64Array: { type: 'string', format: 'byte' },
  BigInt64Array: { type: 'string', format: 'byte' },
  BigUint64Array: { type: 'string', format: 'byte' },
};
