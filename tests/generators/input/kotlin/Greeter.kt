package example
/** Build personalized greetings without network access.
 * ```kotlin
 * val greeter = Greeter()
 * println(greeter.greet("Docsy"))
 * ```
 */
class Greeter {
    /** Greeting prefix used for future calls. */
    var prefix: String = "Hello"
    /** Greet a reader.
     * @param name Reader name.
     * @return A friendly greeting.
     * ```kotlin
     * Greeter().greet("Ada")
     * ```
     */
    fun greet(name: String): String = "$prefix, $name"
    /** Greet several readers in order.
     * ```kotlin
     * Greeter().greetMany(listOf("Ada", "Linus"))
     * ```
     * @param names Reader names.
     * @param separator Separator between greetings.
     * @return Joined greetings.
     */
    fun greetMany(names: List<String>, separator: String = " / "): String = names.joinToString(separator) { greet(it) }
    /** Reject an empty reader name.
     * @param name Reader name.
     * @return A validated greeting.
     * @throws IllegalArgumentException When name is empty.
     */
    fun greetChecked(name: String): String { require(name.isNotBlank()) { "Name must not be empty" }; return greet(name) }
}
/** Supported greeting moods. */
enum class Mood { Friendly, Formal }
