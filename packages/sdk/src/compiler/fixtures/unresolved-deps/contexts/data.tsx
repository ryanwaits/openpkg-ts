// This file imports from a non-existent package
// TypeScript won't auto-include this file when it can't resolve imports
import { something } from 'nonexistent-package';

/**
 * Data provider function
 */
export function DataProvider(): void {
  console.log(something);
}

/**
 * Data context type
 */
export type DataContext = {
  value: string;
};
