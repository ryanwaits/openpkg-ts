export type ModelId =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'claude-3.5-sonnet'
  | 'gemini-pro'
  | 'gemini-ultra'
  | 'mistral-large'
  | 'mistral-medium'
  | 'llama-3-70b'
  | 'llama-3-8b'
  | 'command-r-plus';

export type StatusCode =
  | 200
  | 201
  | 204
  | 400
  | 401
  | 403
  | 404
  | 500
  | 502
  | 503
  | 504;

export type MixedUnion =
  | string
  | number
  | boolean
  | null
  | { type: 'object' }
  | { type: 'array' }
  | { type: 'function' }
  | { type: 'date' }
  | { type: 'regexp' }
  | { type: 'symbol' }
  | { type: 'bigint' };
