//! A real rustdoc fixture.
/// Build personalized greetings without network access.
///
/// # Examples
/// ```
/// let greeting = greeter::Greeter::greet("Docsy");
/// assert_eq!(greeting, "Hello, Docsy");
/// ```
pub struct Greeter {
    /// Greeting prefix for integrations that manage their own formatting.
    pub prefix: String,
}
impl Greeter {
    /// Greet a reader.
    ///
    /// # Examples
    /// ```
    /// let greeting = greeter::Greeter::greet("Docsy");
    /// ```
    pub fn greet(name: &str) -> String { format!("Hello, {}", name) }
    /// Greet several readers while preserving input order.
    ///
    /// # Examples
    /// ```
    /// let greetings = greeter::Greeter::greet_many(&["Ada", "Linus"]);
    /// assert_eq!(greetings.len(), 2);
    /// ```
    pub fn greet_many(names: &[&str]) -> Vec<String> { names.iter().map(|name| Self::greet(name)).collect() }
    /// Reject an empty reader name.
    ///
    /// # Errors
    /// Returns `GreetingError::EmptyName` when name is empty.
    ///
    /// # Examples
    /// ```
    /// assert!(greeter::Greeter::greet_checked("").is_err());
    /// ```
    pub fn greet_checked(name: &str) -> Result<String, GreetingError> { if name.trim().is_empty() { Err(GreetingError::EmptyName) } else { Ok(Self::greet(name)) } }
}
/// Validation failures returned by the greeting API.
pub enum GreetingError {
    /// The reader name must contain at least one character.
    EmptyName,
}
