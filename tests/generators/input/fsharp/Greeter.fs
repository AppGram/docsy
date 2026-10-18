namespace Example
/// <summary>Build personalized greetings without network access.</summary>
/// <example><code>
/// let greeter = Greeter()
/// greeter.Greet("Docsy")
/// </code></example>
type Greeter() =
    /// <summary>Greeting prefix used for future calls.</summary>
    member val Prefix = "Hello" with get, set
    /// <summary>Greet a reader.</summary>
    /// <param name="name">Reader name.</param>
    /// <returns>A friendly greeting.</returns>
    /// <example><code>Greeter().Greet("Ada")</code></example>
    member this.Greet(name: string) : string = this.Prefix + ", " + name
    /// <summary>Greet several readers while preserving input order.</summary>
    /// <param name="names">Reader names.</param>
    /// <returns>Greetings in the same order.</returns>
    /// <example><code>Greeter().GreetMany([| "Ada"; "Linus" |])</code></example>
    member this.GreetMany(names: string array) : string array = names |> Array.map this.Greet
    /// <summary>Reject an empty reader name.</summary>
    /// <param name="name">Reader name.</param>
    /// <returns>A validated greeting.</returns>
    /// <exception cref="T:System.ArgumentException">When name is empty.</exception>
    member this.GreetChecked(name: string) : string =
        if System.String.IsNullOrWhiteSpace(name) then invalidArg "name" "Name must not be empty"
        this.Greet(name)
