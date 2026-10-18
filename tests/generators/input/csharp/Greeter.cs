namespace Example;
/// <summary>Build personalized greetings without network access.</summary>
/// <remarks>Create one greeter per locale. Prefix changes affect future calls.</remarks>
/// <example><code>
/// var greeter = new Greeter();
/// Console.WriteLine(greeter.Greet("Docsy"));
/// </code></example>
public class Greeter {
    /// <summary>Greeting prefix used for future calls.</summary>
    public string Prefix { get; set; } = "Hello";
    /// <summary>Greet a reader.</summary>
    /// <param name="name">Reader name.</param>
    /// <returns>A friendly greeting.</returns>
    /// <example><code>new Greeter().Greet("Ada");</code></example>
    public string Greet(string name) => Prefix + ", " + name;
    /// <summary>Greet several readers while preserving input order.</summary>
    /// <param name="names">Reader names.</param>
    /// <returns>Greetings in the same order.</returns>
    /// <example><code>new Greeter().GreetMany(new[] { "Ada", "Linus" });</code></example>
    public string[] GreetMany(string[] names) => System.Array.ConvertAll(names, Greet);
    /// <summary>Reject an empty reader name.</summary>
    /// <param name="name">Reader name.</param>
    /// <returns>A validated greeting.</returns>
    /// <exception cref="System.ArgumentException">When name is empty.</exception>
    public string GreetChecked(string name) { if (string.IsNullOrWhiteSpace(name)) throw new System.ArgumentException("Name must not be empty"); return Greet(name); }
}
/// <summary>Supported greeting moods.</summary>
public enum Mood { Friendly, Formal }
