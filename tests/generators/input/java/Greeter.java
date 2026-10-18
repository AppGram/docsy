package example;
/** Build personalized greetings without network access.
 * <pre>{@code
 * Greeter greeter = new Greeter();
 * System.out.println(greeter.greet("Docsy"));
 * }</pre>
 */
public class Greeter {
    /** Greeting prefix used for future calls. */
    public String prefix = "Hello";
    /** Supported greeting moods. */
    public enum Mood {
        /** A relaxed tone. */ FRIENDLY,
        /** A professional tone. */ FORMAL
    }
    /** Greet a reader.
     * @param name Reader name.
     * @return A friendly greeting.
     * <pre>{@code new Greeter().greet("Ada");}</pre>
     */
    public String greet(String name) { return prefix + ", " + name; }
    /** Greet several readers in order.
     * <pre>{@code new Greeter().greetMany(new String[]{"Ada", "Linus"});}</pre>
     * @param names Reader names.
     * @return Greetings in the same order.
     */
    public String[] greetMany(String[] names) { return java.util.Arrays.stream(names).map(this::greet).toArray(String[]::new); }
    /** Reject an empty reader name.
     * @param name Reader name.
     * @return A validated greeting.
     * @throws IllegalArgumentException When name is empty.
     */
    public String greetChecked(String name) { if (name.isBlank()) throw new IllegalArgumentException("Name must not be empty"); return greet(name); }
    /** Legacy greeting alias.
     * @deprecated Use {@link #greet(String)}.
     * @param name Reader name.
     * @return A greeting.
     */
    @Deprecated public String hello(String name) { return greet(name); }
}
