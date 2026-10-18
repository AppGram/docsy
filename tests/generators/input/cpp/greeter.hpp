/** Build personalized greetings without network access.
 * @code{.cpp}
 * Greeter greeter;
 * auto message = greeter.greet("Docsy");
 * @endcode
 */
class Greeter {
public:
  /** Greeting prefix used for future calls. */
  const char *prefix;
  /** Greet a reader.
   * @param name Reader name.
   * @return A friendly greeting.
   * @code{.cpp}
   * Greeter().greet("Ada");
   * @endcode
   */
  const char *greet(const char *name);
  /** Greet a batch of readers.
   * @param names Reader names.
   * @param count Number of names.
   * @return Number of greetings produced.
   * @code{.cpp}
   * const char *names[] = {"Ada", "Linus"};
   * Greeter().greetMany(names, 2);
   * @endcode
   */
  unsigned int greetMany(const char **names, unsigned int count);
  /** Reject an empty reader name.
   * @param name Reader name.
   * @return A validated greeting.
   * @throws std::invalid_argument When name is empty.
   */
  const char *greetChecked(const char *name);
};
