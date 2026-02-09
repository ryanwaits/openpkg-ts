import type { OpenPkg } from '@openpkg-ts/spec';
import stacksSpec from './stacks-transactions.json';

/** Real-world spec generated from @stacks/transactions via openpkg CLI */
export const sampleSpec: OpenPkg = stacksSpec as unknown as OpenPkg;
