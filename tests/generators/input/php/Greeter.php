<?php
namespace Example;
/** Build personalized greetings without network access.
 * @example $greeter = new Greeter(); echo $greeter->greet('Docsy');
 */
class Greeter {
    /** Greeting prefix used for future calls.
     * @var string
     */
    public string $prefix = 'Hello';
    /** Greet a reader.
     * @param string $name Reader name.
     * @return string A friendly greeting.
     * @example echo (new Greeter())->greet('Ada');
     */
    public function greet(string $name): string { return $this->prefix . ', ' . $name; }
    /** Greet several readers while preserving input order.
     * @param string[] $names Reader names.
     * @param string $separator Separator between greetings.
     * @return string Joined greetings.
     * @example echo (new Greeter())->greetMany(['Ada', 'Linus']);
     */
    public function greetMany(array $names, string $separator = ' / '): string { return implode($separator, array_map([$this, 'greet'], $names)); }
    /** Reject an empty reader name.
     * @param string $name Reader name.
     * @return string A validated greeting.
     * @throws \InvalidArgumentException When name is empty.
     */
    public function greetChecked(string $name): string { if (!trim($name)) throw new \InvalidArgumentException('Name must not be empty'); return $this->greet($name); }
}
