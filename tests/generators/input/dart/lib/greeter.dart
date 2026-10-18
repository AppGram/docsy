/// A native Dartdoc fixture.
library greeter;

/// Build personalized greetings without network access.
///
/// ```dart
/// final greeter = Greeter();
/// print(greeter.greet('Docsy'));
/// ```
class Greeter {
  /// Greeting prefix used for future calls.
  String prefix = 'Hello';
  /// Greet the reader called [name].
  ///
  /// ```dart
  /// Greeter().greet('Ada');
  /// ```
  String greet(String name) => '$prefix, $name';
  /// Greet several readers while preserving input order.
  ///
  /// ```dart
  /// Greeter().greetMany(['Ada', 'Linus'], separator: ' / ');
  /// ```
  String greetMany(List<String> names, {String separator = ' / '}) => names.map(greet).join(separator);
  /// Reject an empty [name]. Throws [ArgumentError] when name is empty.
  String greetChecked(String name) { if (name.trim().isEmpty) throw ArgumentError('Name must not be empty'); return greet(name); }
}
/// Supported greeting moods.
enum Mood { friendly, formal }
