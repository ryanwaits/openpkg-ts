/**
 * Chainable, lazy query builder for filtering OpenPkg exports.
 */

import type { OpenPkg, SpecExport, SpecExportKind } from '@openpkg-ts/spec';

type Predicate = (exp: SpecExport) => boolean;

/**
 * Chainable query builder for filtering OpenPkg exports.
 * Filters are lazy - predicates only run on execution methods (find, first, count, etc).
 */
export class QueryBuilder {
  private predicates: Predicate[] = [];

  constructor(private spec: OpenPkg) {}

  /**
   * Filter by export kind(s)
   */
  byKind(...kinds: SpecExportKind[]): this {
    if (kinds.length > 0) {
      this.predicates.push((exp) => kinds.includes(exp.kind));
    }
    return this;
  }

  /**
   * Filter by name (exact string or regex pattern)
   */
  byName(pattern: string | RegExp): this {
    if (typeof pattern === 'string') {
      this.predicates.push((exp) => exp.name === pattern);
    } else {
      this.predicates.push((exp) => pattern.test(exp.name));
    }
    return this;
  }

  /**
   * Filter by tag(s) - export must have at least one matching tag
   */
  byTag(...tags: string[]): this {
    if (tags.length > 0) {
      this.predicates.push((exp) => {
        const expTags = exp.tags?.map((t) => t.name) ?? [];
        return tags.some((tag) => expTags.includes(tag));
      });
    }
    return this;
  }

  /**
   * Filter by deprecation status
   * @param include - true = only deprecated, false = exclude deprecated, undefined = all
   */
  deprecated(include?: boolean): this {
    if (include !== undefined) {
      this.predicates.push((exp) => (exp.deprecated ?? false) === include);
    }
    return this;
  }

  /**
   * Filter to exports with descriptions only
   */
  withDescription(): this {
    this.predicates.push((exp) => Boolean(exp.description?.trim()));
    return this;
  }

  /**
   * Search name and description (case-insensitive)
   */
  search(term: string): this {
    const lower = term.toLowerCase();
    this.predicates.push(
      (exp) =>
        exp.name.toLowerCase().includes(lower) ||
        (exp.description?.toLowerCase().includes(lower) ?? false),
    );
    return this;
  }

  /**
   * Custom predicate filter
   */
  where(predicate: Predicate): this {
    this.predicates.push(predicate);
    return this;
  }

  /**
   * Filter by source module/file path (contains match)
   */
  byModule(modulePath: string): this {
    this.predicates.push((exp) => exp.source?.file?.includes(modulePath) ?? false);
    return this;
  }

  // ==========================================================================
  // Execution methods (lazy - predicates run here)
  // ==========================================================================

  private matches(exp: SpecExport): boolean {
    return this.predicates.every((p) => p(exp));
  }

  /**
   * Execute query and return matching exports
   */
  find(): SpecExport[] {
    return this.spec.exports.filter((exp) => this.matches(exp));
  }

  /**
   * Execute query and return first match (or undefined)
   */
  first(): SpecExport | undefined {
    return this.spec.exports.find((exp) => this.matches(exp));
  }

  /**
   * Execute query and return count of matches
   */
  count(): number {
    return this.spec.exports.filter((exp) => this.matches(exp)).length;
  }

  /**
   * Execute query and return IDs of matching exports
   */
  ids(): string[] {
    return this.find().map((exp) => exp.id);
  }

  /**
   * Execute query and return a new filtered OpenPkg spec
   */
  toSpec(): OpenPkg {
    return {
      ...this.spec,
      exports: this.find(),
      types: this.spec.types ? [...this.spec.types] : undefined,
    };
  }
}

/**
 * Create a query builder for the given spec
 */
export function query(spec: OpenPkg): QueryBuilder {
  return new QueryBuilder(spec);
}
