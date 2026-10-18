/** Build personalized greetings without network access.
 * @example
 * const greeter = new Greeter();
 * console.log(greeter.greet('Docsy'));
 */
export class Greeter {
  /** Greeting prefix.
   * @type {string}
   * @default 'Hello'
   */
  prefix = 'Hello';
  /** Greet a reader.
   * @param {string} name Reader name.
   * @returns {string} A friendly greeting.
   * @example
   * new Greeter().greet('Docsy');
   */
  greet(name) { return `${this.prefix}, ${name}`; }
  /** Greet several readers in order.
   * @param {string[]} names Reader names.
   * @param {string} [separator=' / '] Separator between greetings.
   * @returns {string} Joined greetings.
   * @example
   * new Greeter().greetMany(['Ada', 'Linus']);
   */
  greetMany(names, separator = ' / ') { return names.map(name => this.greet(name)).join(separator); }
  /** Reject an empty reader name.
   * @param {string} name Reader name.
   * @returns {string} A validated greeting.
   * @throws {TypeError} When name is empty.
   * @example
   * new Greeter().greetChecked('Ada');
   */
  greetChecked(name) { if (!name.trim()) throw new TypeError('Name must not be empty'); return this.greet(name); }
  /** @deprecated Use greet instead.
   * @param {string} name Reader name.
   * @returns {string} A greeting.
   */
  hello(name) { return this.greet(name); }
}
