/** A user account. */
export class User {
  name = '';
  /** Greet by name. */
  greet(): string {
    return `hi ${this.name}`;
  }
}

/** Greets someone. */
export function greet(name: string): string {
  return `hello ${name}`;
}
