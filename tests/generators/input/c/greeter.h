/** @file greeter.h Native C Doxygen fixture. */
/** Greet a reader.
 * @param name Reader name.
 * @return A friendly greeting.
 * @code{.c}
 * const char *message = greet("Docsy");
 * @endcode
 */
const char *greet(const char *name);
/** Greeting options shared by batch operations. */
struct GreetingOptions {
    /** Prefix inserted before each name. */
    const char *prefix;
    /** Maximum number of readers accepted. */
    unsigned int limit;
};
/** Supported greeting moods. */
enum Mood { Friendly, Formal };
/** Greet a batch of readers.
 * @param names Reader names.
 * @param count Number of names.
 * @return Zero on success; a non-zero error code for invalid input.
 * @code{.c}
 * const char *names[] = {"Ada", "Linus"};
 * int status = greet_many(names, 2);
 * @endcode
 */
int greet_many(const char **names, unsigned int count);
