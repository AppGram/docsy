export const SDK_FORMATS = ['typedoc-lite', 'swift-symbols', 'typedoc', 'jsdoc', 'dartdoc', 'docc', 'sphinx', 'javadoc', 'dokka', 'scaladoc', 'rustdoc', 'godoc', 'doxygen', 'docfx', 'phpdoc', 'yard', 'ldoc', 'exdoc'] as const;
export const NATIVE_LANGUAGE_FORMATS = {
  javascript: 'jsdoc', typescript: 'typedoc', python: 'sphinx', java: 'javadoc', kotlin: 'dokka', scala: 'scaladoc',
  csharp: 'docfx', fsharp: 'docfx', visualbasic: 'docfx', c: 'doxygen', cpp: 'doxygen', objectivec: 'doxygen',
  go: 'godoc', rust: 'rustdoc', swift: 'docc', dart: 'dartdoc', php: 'phpdoc', ruby: 'yard', elixir: 'exdoc', lua: 'ldoc',
} as const;
