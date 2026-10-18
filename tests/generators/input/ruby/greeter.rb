# Build personalized greetings without network access.
# @example
#   greeter = Greeter.new
#   puts greeter.greet('Docsy')
class Greeter
  # Greeting prefix for integrations that manage their own formatting.
  # @return [String, nil] A custom prefix.
  attr_accessor :prefix
  # Greet a reader.
  # @param name [String] Reader name.
  # @return [String] A friendly greeting.
  # @example
  #   Greeter.new.greet('Docsy')
  def greet(name)
    "Hello, #{name}"
  end
  # Greet several readers while preserving input order.
  # @param names [Array<String>] Reader names.
  # @param separator [String] Separator between greetings.
  # @return [String] Joined greetings.
  # @example
  #   Greeter.new.greet_many(['Ada', 'Linus'], ' / ')
  def greet_many(names, separator = ' / ')
    names.map { |name| greet(name) }.join(separator)
  end
  # Reject an empty reader name.
  # @param name [String] Reader name.
  # @return [String] A validated greeting.
  # @raise [ArgumentError] When name is empty.
  def greet_checked(name)
    raise ArgumentError, 'Name must not be empty' if name.strip.empty?
    greet(name)
  end
end
