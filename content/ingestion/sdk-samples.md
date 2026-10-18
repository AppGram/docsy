The portal now imports actual documentation-generator artifacts for **20 source languages**, rather than relabeling manually prepared compact JSON as native support. Every sample was generated from source code in `tests/generators/input/`.

## Native samples

| Language / reference | Native adapter | What to inspect in this sample |
| --- | --- | --- |
| [Swift](/swift-sdk) | `docc` | Struct, property, enum cases, default arguments, throwing method, 3 examples |
| [Dart](/dart-sdk) | `dartdoc` | Class, property, enum values, named optional argument, 3 examples |
| [TypeScript](/typescript-sdk) | `typedoc` | Class, interface, properties, enum, optional/default arguments, remarks, deprecation, errors, 4 examples |
| [JavaScript](/javascript-sdk) | `jsdoc` | Class, property, optional arguments, deprecation, typed errors, 4 examples |
| [Python](/python-sdk) | `sphinx` | Class, attribute, typed lists, optional arguments, return prose, raised exception, 4 examples |
| [Rust](/rust-sdk) | `rustdoc` | Struct field, enum variant, slices, `Result` error contract, 4 examples |
| [C#](/dotnet-sdk) | `docfx` | Class, property, enum values, arrays, remarks, exceptions, 3 examples |
| [F#](/fsharp-sdk) | `docfx` | Class, property, arrays, exceptions, 3 F# examples; declarations use DocFX's C# fallback |
| [Visual Basic](/visualbasic-sdk) | `docfx` | Class, property, arrays, exceptions, native VB declarations, 3 examples |
| [Kotlin](/kotlin-sdk) | `dokka` | Class, property, enum values, default arguments, typed throws, 3 examples |
| [Java](/java-sdk) | `javadoc` | Class, field, enum constants, arrays, deprecation, throws, 3 examples |
| [Scala](/scala-sdk) | `scaladoc` | Class, property, typed lists, default argument, return prose, throws, 4 examples |
| [Go](/go-sdk) | `godoc` | Struct fields, interface declaration, receiver methods, slices, 3 usage blocks |
| [C](/c-sdk) | `doxygen` | Struct fields, enum values, pointer arguments, documented status return, 2 examples |
| [C++](/cpp-sdk) | `doxygen` | Class, property, pointer arguments, return prose, exceptions, 3 examples |
| [Objective-C](/objectivec-sdk) | `doxygen` | Class, property, multi-part selectors, pointer arguments, return prose, 3 examples |
| [PHP](/php-sdk) | `phpdoc` | Class, property, default arguments, arrays, exceptions, 3 examples |
| [Ruby](/ruby-sdk) | `yard` | Class, attribute, typed parameters, default argument, raised exception, 3 examples |
| [Elixir](/elixir-sdk) | `exdoc` | Module documentation, typed list functions, validation prose, 4 `iex` examples |
| [Lua](/lua-sdk) | `ldoc` | Functions, typed tables, optional argument, return documentation, raised error, 3 usage examples |

These are small teaching libraries, not published SDK packages. Their source implements a greeting API so you can compare the same concepts across generators. The method signatures, parameters, return types, and descriptions on the native pages are imported from generator output, not authored in the site YAML.

## Read a richer reference

Every language now includes a batch operation as well as the single-reader method. Open **In this reference → examples** to jump directly to imported usage code. The counts are computed from the imported symbols, not hard-coded per language.

- **Examples** come from native documentation comments: TypeDoc/JSDoc `@example`, Python literal blocks, Javadoc `<pre>`, KDoc Markdown, Scaladoc code blocks, Swift DocC code listings, rustdoc fences, compiler XML `<example>`, Doxygen `@code`, phpDocumentor `@example`, YARD `@example`, ExDoc `iex` blocks, and LDoc `@usage`.
- **Parameters and returns** preserve types and descriptions where the generator supplies them. Optional/default parameters are marked when exposed by the input. Properties, enum values, remarks, deprecations, and error contracts are shown when imported; unsupported or absent metadata is not invented.
- **Errors** are separate from usage examples. Dart and Elixir's validation behavior remains in native prose in these fixtures. Go does not have exceptions; the C sample documents status codes in its return description. These are not falsely labeled as structured thrown exceptions.
- **Examples are library usage**, not automatically generated HTTP requests. The [OpenAPI example](/api/posts) has its own language selector for request code.

The samples demonstrate supported content, not every feature of every language's documentation generator. Native annotations, inter-package links, source browsing, tutorials, and complex type layouts are not all reproduced. Go's usage blocks come from source comments in `go doc -all`; this importer does not discover `Example*` test functions. Example code is displayed as documentation, not executed by the Docsy renderer.

## Verify the provenance

`sources/native/provenance.json` records all 20 languages, generator versions, exact input and output files, SHA-256 hashes, and reproduction commands. `npm test` verifies those hashes and imports each native artifact. Changing fixture source without regenerating the output fails the provenance test.

The recorded tools are TypeDoc, JSDoc, Sphinx, Javadoc, Dokka, Scaladoc, DocFX, Doxygen, Go's standard documentation tool, stable rustdoc, Swift DocC, Dartdoc, phpDocumentor, YARD, ExDoc, and LDoc. A single native format can serve several languages: Doxygen covers C/C++/Objective-C, and DocFX imports the C#/F#/VB compiler assemblies and XML comments.

Only original reference artifacts are retained. Generator CSS, JavaScript, fonts, compiler binaries, and caches are excluded. The importers parse data; they do not embed or execute the upstream documentation site.

## Configure a native source

```yaml
ingestion:
  sdks:
    - id: python
      slug: python-sdk
      adapter: sphinx
      source: sources/native/python
      name: Python library
      language: python
      install: ''
      overview: Reference imported from Sphinx JSON output.
      icon: assets/sdks/python.svg
      maxFiles: 10000
      maxFileBytes: 10485760
      maxTotalBytes: 104857600
```

Change `adapter`, `source`, and `language` to choose an input. A source may be the generator's individual artifact file or a directory of native artifacts. The exact expected format is documented in **SDK adapters**. Native SDK inputs are local files; URL downloads and archive extraction are deliberately not performed by the renderer.

Branding stays configurable: `icon` is the local SVG for the overview card and reference heading. Add `iconDark: assets/my-language-dark.svg` when a mark needs a light variant on dark backgrounds. The portal vendors all 20 language marks locally; it does not load an icon font or a tracking/CDN asset. Replacing an icon does not change ingestion.

Version-specific inputs still use `versions: { preview: sources/preview/python }`. Add the registered `slug` to navigation as usual. Search, Markdown, agent JSON, locale routing, and access rules use the same normalized reference model. Native descriptions retain their generator's language; selecting a locale does not automatically translate upstream API text.

## Regenerate the real fixtures

Install Docsy's npm development dependencies, then build the isolated Linux generator image:

```bash
npm ci
npm run fixtures:image
npm run fixtures:generate
npm test
npm run validate
npm run build
```

Run these commands from a repository checkout. The full reproduction run also needs Python, a JDK, Go, stable Rust, Ruby, Dart, and the Swift compiler/DocC tool. It downloads documentation-tool dependencies into the ignored `.docsy/generators/` cache. Docker supplies Doxygen, DocFX, phpDocumentor, LDoc, and ExDoc. Toolchains are needed to regenerate fixtures, **not** to import their checked-in output or build Docsy.

Use `npm run fixtures:generate -- --only python,java` for a subset. Host paths can be selected with `DOCSY_JAVA_HOME`, `DOCSY_PYTHON`, `DOCSY_DART`, `DOCSY_RUBY`, and `DOCSY_DOCC`. The full Swift generation step uses a standalone source file and CLI tools; it never invokes `xcodebuild` or builds an Xcode project. The reproduction script currently targets macOS/Linux hosts; Windows users can consume the generated artifacts without running this script.

## Know the format boundaries

- **F#:** DocFX is run against an actual compiled F# assembly and compiler XML comments. When DocFX supplies C# declarations instead of F# syntax, the code block is labeled C#, not disguised as F#.
- **Scala:** this adapter is tested against Scaladoc 2 HTML, not Scala 3's different output.
- **Rust:** the importer reads stable rustdoc HTML; it does not depend on the unstable nightly JSON schema. Generator-provided inherited methods may appear.
- **HTML formats:** selectors are tested against the recorded generator versions. Custom themes or incompatible generator versions can need an adapter update. The reference is normalized, not a pixel-identical copy of the original documentation.
- **Cross-references:** basic native inheritance/conformance references are retained where available. This is not a full reproduction of every upstream generator feature, source browser, or inter-package link resolver.

## Keep portable metadata separate

[Portable metadata](/compact-sdk) remains available for custom pipelines. That page and the legacy converter regression fixtures are explicitly hand-authored examples. They are **not counted** as native-language coverage. The Swift `swift-symbols` adapter for AppGram/docc2json remains supported alongside the direct `docc` importer.

For HTTP requests rather than library symbols, open [Posts](/api/posts) and use the request-language selector. Those snippets are generated from OpenAPI; they are not native library-documentation imports.
