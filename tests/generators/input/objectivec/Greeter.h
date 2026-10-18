/** Build personalized greetings without network access.
 * @code{.m}
 * Greeter *greeter = [Greeter new];
 * const char *message = [greeter greet:"Docsy"];
 * @endcode
 */
@interface Greeter
/** Greeting prefix used for future calls. */
@property const char *prefix;
/** Greet a reader.
 * @param name Reader name.
 * @return A friendly greeting.
 * @code{.m}
 * [greeter greet:"Ada"];
 * @endcode
 */
- (const char *)greet:(const char *)name;
/** Greet a batch of readers.
 * @param names Reader names.
 * @param count Number of names.
 * @return Number of greetings produced.
 * @code{.m}
 * const char *names[] = {"Ada", "Linus"};
 * [greeter greetMany:names count:2];
 * @endcode
 */
- (unsigned int)greetMany:(const char **)names count:(unsigned int)count;
@end
