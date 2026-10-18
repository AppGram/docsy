package example
/** Build personalized greetings without network access.
  * @example {{{
  * val greeter = new Greeter
  * println(greeter.greet("Docsy"))
  * }}}
  */
class Greeter {
  /** Greeting prefix used for future calls. */
  var prefix: String = "Hello"
  /** Greet a reader.
    * @param name Reader name.
    * @return A friendly greeting.
    * @example {{{new Greeter().greet("Ada")}}}
    */
  def greet(name: String): String = prefix + ", " + name
  /** Greet several readers while preserving input order.
    * @param names Reader names.
    * @param separator Separator between greetings.
    * @return Joined greetings.
    * @example {{{new Greeter().greetMany(List("Ada", "Linus"))}}}
    */
  def greetMany(names: List[String], separator: String = " / "): String = names.map(greet).mkString(separator)
  /** Reject an empty reader name.
    * @param name Reader name.
    * @return A validated greeting.
    * @throws IllegalArgumentException When name is empty.
    * @example {{{new Greeter().greetChecked("Ada")}}}
    */
  def greetChecked(name: String): String = { require(name.trim.nonEmpty, "Name must not be empty"); greet(name) }
}
