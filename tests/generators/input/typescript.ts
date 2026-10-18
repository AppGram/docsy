/** Build personalized greetings without network access.
 * @remarks Create one greeter per locale. Prefix changes apply to future greetings.
 * @example
 * const greeter = new Greeter();
 * greeter.prefix = 'Welcome';
 * console.log(greeter.greet('Docsy'));
 */
export class Greeter {
  /** Greeting prefix. */
  prefix: string = 'Hello';
  /** Greet a reader.
   * @param name Reader name.
   * @returns A friendly greeting.
   * @example
   * new Greeter().greet('Docsy');
   */
  greet(name: string): string { return `${this.prefix}, ${name}`; }
  /** Greet several readers while preserving input order.
   * @param names Reader names.
   * @param separator Separator between greetings.
   * @returns Joined greetings.
   * @example
   * new Greeter().greetMany(['Ada', 'Linus'], ' / ');
   */
  greetMany(names: string[], separator: string = '\n'): string { return names.map(name => this.greet(name)).join(separator); }
  /** Validate a name before greeting it.
   * @throws Error when the name is empty.
   * @example
   * new Greeter().greetChecked('Ada');
   */
  greetChecked(name: string): string { if (!name.trim()) throw new Error('Name must not be empty'); return this.greet(name); }
  /** Use greet instead.
   * @deprecated Use greet(name) for consistent formatting.
   */
  hello(name: string): string { return this.greet(name); }
}
/** Supported greeting moods. */
export enum Mood { Friendly = 'friendly', Formal = 'formal' }
/** Options accepted by greeting integrations. */
export interface GreetingOptions {
  /** Desired greeting tone. */
  mood: Mood;
  /** Optional salutation override. */
  prefix?: string;
}
