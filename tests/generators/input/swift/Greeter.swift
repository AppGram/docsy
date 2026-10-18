/// Build personalized greetings without network access.
///
/// ```swift
/// let greeter = Greeter()
/// print(greeter.greet(name: "Docsy"))
/// ```
public struct Greeter {
    /// Greeting prefix used for future calls.
    public var prefix: String = "Hello"
    /// Create a greeter.
    public init() {}
    /// Greet a reader.
    /// - Parameter name: Reader name.
    /// - Returns: A friendly greeting.
    ///
    /// ```swift
    /// Greeter().greet(name: "Ada")
    /// ```
    public func greet(name: String) -> String { "\(prefix), \(name)" }
    /// Greet several readers while preserving input order.
    ///
    /// ```swift
    /// Greeter().greetMany(names: ["Ada", "Linus"])
    /// ```
    /// - Parameters:
    ///   - names: Reader names.
    ///   - separator: Separator between greetings.
    /// - Returns: Joined greetings.
    public func greetMany(names: [String], separator: String = " / ") -> String { names.map { greet(name: $0) }.joined(separator: separator) }
    /// Reject an empty reader name.
    /// - Parameter name: Reader name.
    /// - Throws: `GreetingError.emptyName` when name is empty.
    /// - Returns: A validated greeting.
    public func greetChecked(name: String) throws -> String { if name.isEmpty { throw GreetingError.emptyName }; return greet(name: name) }
}
/// Validation failures raised by the greeting API.
public enum GreetingError: Error {
    /// The reader name must contain at least one character.
    case emptyName
}
