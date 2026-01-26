export class Example {
  public name: string;
  protected internal: string;

  constructor() {
    this.name = 'example';
    this.secret = 'hidden';
    this.internal = 'protected';
    this.#esPrivate = 'truly private';
  }

  public getName(): string {
    return this.name;
  }

  protected getInternal(): string {
    return this.internal;
  }
}

export class ExtendedExample extends Example {
  public extra: string = 'extra';

  public getExtra(): string {
    return this.extra;
  }
}
