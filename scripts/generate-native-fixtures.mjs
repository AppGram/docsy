// Run real documentation tools. No fixture payload is synthesized by this script.
// Generated artifacts are copied byte-for-byte; provenance records source/output hashes.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';

const root = process.cwd();
const cache = resolve('.docsy/generators');
const input = resolve('tests/generators/input');
const output = resolve('sources/native');
mkdirSync(cache, { recursive: true }); mkdirSync(output, { recursive: true });
const selected = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const manifestPath = join(output, 'provenance.json');
let manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { schemaVersion: 1, fixtures: [] };
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr || result.error || ''}`);
  return `${result.stdout || ''}${result.stderr || ''}`;
};
const files = (dir) => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
  if (['bin', 'obj', 'deps', '_build', '__pycache__', '.dart_tool', 'target'].includes(entry.name)) return [];
  const path = join(dir, entry.name); return entry.isDirectory() ? files(path) : [path];
});
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const record = (language, adapter, generator, version, commands, source) => {
  const sourcePath = join(input, source);
  const paths = statSync(sourcePath).isDirectory() ? files(sourcePath) : [sourcePath];
  const generated = files(join(output, language));
  if (!generated.length) throw new Error(`No generator output for ${language}`);
  const item = { language, adapter, generator, version: version.trim(), commands, input: paths.map((path) => ({ path: relative(root, path), sha256: hash(path) })), output: generated.map((path) => ({ path: relative(root, path), sha256: hash(path) })) };
  manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : manifest;
  manifest.fixtures = [...manifest.fixtures.filter((fixture) => fixture.language !== language), item].sort((a, b) => a.language.localeCompare(b.language));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${language}: ${generator} (${generated.length} original artifact files)`);
};
const download = async (url, path) => {
  if (!existsSync(path)) { const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, Buffer.from(await response.arrayBuffer())); }
  return path;
};
const docker = (script) => run('docker', ['run', '--rm', '-v', `${root}:/work`, '-w', '/work', 'docsy-generators:local', 'sh', '-ec', script]);
const enabled = (language) => !selected || selected.includes(language);
const javaHome = process.env.DOCSY_JAVA_HOME || (existsSync('/Applications/Android Studio.app/Contents/jbr/Contents/Home') ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home' : process.env.JAVA_HOME);
const java = javaHome ? join(javaHome, 'bin/java') : 'java';
const javadoc = javaHome ? join(javaHome, 'bin/javadoc') : 'javadoc';
const dart = process.env.DOCSY_DART || (existsSync('/opt/homebrew/share/flutter/bin/cache/dart-sdk/bin/dart') ? '/opt/homebrew/share/flutter/bin/cache/dart-sdk/bin/dart' : 'dart');
const python = process.env.DOCSY_PYTHON || (existsSync('/opt/homebrew/opt/python@3.13/bin/python3.13') ? '/opt/homebrew/opt/python@3.13/bin/python3.13' : 'python3');
const ruby = process.env.DOCSY_RUBY || (existsSync('/opt/homebrew/opt/ruby/bin/ruby') ? '/opt/homebrew/opt/ruby/bin/ruby' : 'ruby');
const gem = ruby.includes('/') ? join(dirname(ruby), 'gem') : 'gem';

if (enabled('typescript')) {
  mkdirSync(join(output, 'typescript'), { recursive: true });
  run('node', ['node_modules/typedoc/bin/typedoc', '--tsconfig', 'tests/generators/tsconfig.json', '--skipErrorChecking', '--json', join(output, 'typescript/api.json'), join(input, 'typescript.ts')]);
  // Single-file inputs have the same source hash tracking as directory fixtures.
  record('typescript', 'typedoc', 'TypeDoc', run('node', ['node_modules/typedoc/bin/typedoc', '--version']), ['npx typedoc --tsconfig tests/generators/tsconfig.json --json sources/native/typescript/api.json tests/generators/input/typescript.ts'], 'typescript.ts');
}
if (enabled('javascript')) {
  mkdirSync(join(output, 'javascript'), { recursive: true });
  const result = run('node', ['node_modules/jsdoc/jsdoc.js', '-X', join(input, 'javascript.js')]);
  writeFileSync(join(output, 'javascript/api.json'), result);
  record('javascript', 'jsdoc', 'JSDoc', run('node', ['node_modules/jsdoc/jsdoc.js', '--version']), ['npx jsdoc -X tests/generators/input/javascript.js > sources/native/javascript/api.json'], 'javascript.js');
}
if (enabled('python')) {
  const venv = join(cache, 'python');
  if (!existsSync(join(venv, 'bin/sphinx-build'))) {
    run(python, ['-m', 'venv', venv]); run(join(venv, 'bin/pip'), ['install', 'sphinx==8.2.3']);
  }
  run(join(venv, 'bin/sphinx-build'), ['-b', 'json', join(input, 'python'), join(output, 'python')]);
  record('python', 'sphinx', 'Sphinx', run(join(venv, 'bin/sphinx-build'), ['--version']), ['sphinx-build -b json tests/generators/input/python sources/native/python'], 'python');
}
if (enabled('java')) {
  run(javadoc, ['-quiet', '-d', join(output, 'java'), join(input, 'java/Greeter.java')]);
  record('java', 'javadoc', 'Javadoc', run(javadoc, ['--version']), ['javadoc -d sources/native/java tests/generators/input/java/Greeter.java'], 'java');
}
if (enabled('kotlin')) {
  mkdirSync(join(output, 'kotlin'), { recursive: true });
  const version = '2.2.0';
  const deps = [['org/jetbrains/dokka', 'dokka-cli', version], ['org/jetbrains/dokka', 'dokka-base', version], ['org/jetbrains/dokka', 'analysis-kotlin-symbols', version], ['org/jetbrains/kotlinx', 'kotlinx-html-jvm', '0.8.0'], ['org/freemarker', 'freemarker', '2.3.31']];
  const jars = await Promise.all(deps.map(([group, name, v]) => download(`https://repo.maven.apache.org/maven2/${group}/${name}/${v}/${name}-${v}.jar`, join(cache, `${name}-${v}.jar`))));
  run(java, ['-jar', jars[0], '-pluginsClasspath', jars.slice(1).join(';'), '-sourceSet', `-src ${join(input, 'kotlin')} -noStdlibLink -noJdkLink`, '-moduleName', 'Greeter', '-offlineMode', '-outputDir', join(output, 'kotlin')]);
  record('kotlin', 'dokka', 'Dokka', version, ['java -jar dokka-cli-2.2.0.jar -pluginsClasspath "<Dokka HTML dependencies>" -sourceSet "-src tests/generators/input/kotlin -noStdlibLink -noJdkLink" -moduleName Greeter -offlineMode -outputDir sources/native/kotlin'], 'kotlin');
}
if (enabled('scala')) {
  const version = '2.13.16';
  const jars = await Promise.all(['scala-library', 'scala-reflect', 'scala-compiler'].map((name) => download(`https://repo.maven.apache.org/maven2/org/scala-lang/${name}/${version}/${name}-${version}.jar`, join(cache, `${name}-${version}.jar`))));
  const xml = await download('https://repo.maven.apache.org/maven2/org/scala-lang/modules/scala-xml_2.13/2.3.0/scala-xml_2.13-2.3.0.jar', join(cache, 'scala-xml.jar'));
  mkdirSync(join(output, 'scala'), { recursive: true });
  run(java, ['-Dscala.usejavacp=true', '-cp', [...jars, xml].join(':'), 'scala.tools.nsc.ScalaDoc', '-d', join(output, 'scala'), join(input, 'scala/Greeter.scala')]);
  record('scala', 'scaladoc', 'Scaladoc', version, ['java -Dscala.usejavacp=true -cp "<Scala compiler dependencies>" scala.tools.nsc.ScalaDoc -d sources/native/scala tests/generators/input/scala/Greeter.scala'], 'scala');
}
if (enabled('rust')) {
  run('rustdoc', ['--edition=2021', '--crate-name', 'greeter', join(input, 'rust/greeter.rs'), '-o', join(output, 'rust')]);
  record('rust', 'rustdoc', 'rustdoc (stable HTML)', run('rustdoc', ['--version']), ['rustdoc --edition=2021 --crate-name greeter tests/generators/input/rust/greeter.rs -o sources/native/rust'], 'rust');
}
if (enabled('go')) {
  mkdirSync(join(output, 'go'), { recursive: true });
  const result = run('go', ['doc', '-all', '.'], { cwd: join(input, 'go') });
  writeFileSync(join(output, 'go/api.txt'), result);
  record('go', 'godoc', 'go doc', run('go', ['version']), ['cd tests/generators/input/go && go doc -all . > ../../../../sources/native/go/api.txt'], 'go');
}
if (enabled('swift')) {
  const work = join(cache, 'swift'); mkdirSync(work, { recursive: true });
  // Standalone source only. Never xcodebuild, never an Xcode project.
  run('swiftc', ['-emit-module', '-emit-module-path', join(work, 'Greeter.swiftmodule'), '-emit-symbol-graph', '-emit-symbol-graph-dir', work, '-module-name', 'Greeter', join(input, 'swift/Greeter.swift')]);
  const docc = process.env.DOCSY_DOCC || '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/docc';
  run(docc, ['convert', '--additional-symbol-graph-dir', work, '--fallback-display-name', 'Greeter', '--fallback-bundle-identifier', 'com.example.greeter', '--output-path', join(output, 'swift')]);
  record('swift', 'docc', 'Swift DocC', run('swiftc', ['--version']), ['swiftc -emit-module -emit-symbol-graph -emit-symbol-graph-dir <cache> -module-name Greeter tests/generators/input/swift/Greeter.swift', 'docc convert --additional-symbol-graph-dir <cache> --fallback-display-name Greeter --fallback-bundle-identifier com.example.greeter --output-path sources/native/swift'], 'swift');
}
if (enabled('dart')) {
  run(dart, ['pub', 'get'], { cwd: join(input, 'dart'), env: { ...process.env, PUB_CACHE: join(cache, 'pub') } });
  run(dart, ['doc', '--output', join(output, 'dart')], { cwd: join(input, 'dart'), env: { ...process.env, PUB_CACHE: join(cache, 'pub') } });
  record('dart', 'dartdoc', 'dart doc', run(dart, ['--version']), ['cd tests/generators/input/dart && dart pub get && dart doc --output ../../../../sources/native/dart'], 'dart');
}
if (enabled('ruby')) {
  const gems = join(cache, 'gems');
  if (!existsSync(join(gems, 'gems/yard-0.9.38'))) run(gem, ['install', '--no-document', '--install-dir', gems, 'yard', '--version', '0.9.38']);
  const yard = join(gems, 'gems/yard-0.9.38/bin/yardoc');
  const gemPath = [gems, ...run(ruby, ['-e', 'puts Gem.path']).trim().split('\n')].join(':');
  run(ruby, [yard, '--db', join(cache, 'fixture.yardoc'), '--no-cache', '--no-document', '--no-yardopts', '--fail-on-warning', '--output-dir', join(output, 'ruby'), join(input, 'ruby/greeter.rb')], { env: { ...process.env, GEM_PATH: gemPath } });
  record('ruby', 'yard', 'YARD', '0.9.38', ['yard doc --db .docsy/generators/fixture.yardoc --no-cache --no-document --no-yardopts --output-dir sources/native/ruby tests/generators/input/ruby/greeter.rb'], 'ruby');
}
for (const [language, filename] of [['c', 'greeter.h'], ['cpp', 'greeter.hpp'], ['objectivec', 'Greeter.h']]) if (enabled(language)) {
  const config = `PROJECT_NAME = Greeter\nINPUT = /work/tests/generators/input/${language}/${filename}\nOUTPUT_DIRECTORY = /work/sources/native/${language}\nGENERATE_XML = YES\nXML_OUTPUT = .\nGENERATE_HTML = NO\nGENERATE_LATEX = NO\nEXTRACT_ALL = YES\nQUIET = YES\n${language === 'objectivec' ? 'EXTENSION_MAPPING = h=Objective-C\n' : ''}`;
  const path = join(cache, `${language}.doxyfile`); writeFileSync(path, config);
  docker(`doxygen .docsy/generators/${language}.doxyfile`);
  record(language, 'doxygen', 'Doxygen', docker('doxygen --version'), [`doxygen .docsy/generators/${language}.doxyfile`], language);
}
for (const [language, extension] of [['csharp', 'csproj'], ['fsharp', 'fsproj'], ['visualbasic', 'vbproj']]) if (enabled(language)) {
  const dir = `tests/generators/input/${language}`;
  docker(`dotnet build ${dir}/Greeter.${extension} -c Release -v quiet`);
  const config = { metadata: [{ src: [{ files: [`${dir}/bin/Release/net8.0/Greeter.dll`] }], dest: `sources/native/${language}`, disableGitFeatures: true }] };
  writeFileSync(join(root, `.docsy-generators-${language}.json`), JSON.stringify(config));
  try { docker(`/tools/docfx metadata .docsy-generators-${language}.json`); }
  finally { /* Retain generated configuration with fixture provenance below, not at repository root. */ }
  // DocFX resolves paths relative to its config. Root config is generated, then moved to cache.
  const configPath = join(root, `.docsy-generators-${language}.json`);
  const { renameSync } = await import('node:fs'); renameSync(configPath, join(cache, `${language}.docfx.json`));
  record(language, 'docfx', 'DocFX (assembly + compiler XML)', docker('/tools/docfx --version'), [`dotnet build ${dir}/Greeter.${extension} -c Release`, `/tools/docfx metadata <assembly-and-XML-config>`], language);
}
if (enabled('php')) {
  docker('php /tools/phpDocumentor.phar -d tests/generators/input/php -t sources/native/php --template=xml --cache-folder=.docsy/generators/php-cache');
  record('php', 'phpdoc', 'phpDocumentor', docker('php /tools/phpDocumentor.phar --version'), ['php phpDocumentor.phar -d tests/generators/input/php -t sources/native/php --template=xml'], 'php');
}
if (enabled('lua')) {
  docker('ldoc --dir sources/native/lua tests/generators/input/lua/greeter.lua');
  record('lua', 'ldoc', 'LDoc', docker('dpkg-query -W lua-ldoc'), ['ldoc --dir sources/native/lua tests/generators/input/lua/greeter.lua'], 'lua');
}
if (enabled('elixir')) {
  docker('cd tests/generators/input/elixir && mix local.hex --force && mix deps.get && mix docs --output /work/sources/native/elixir');
  record('elixir', 'exdoc', 'ExDoc', '0.34.2', ['cd tests/generators/input/elixir && mix deps.get && mix docs --output ../../../../sources/native/elixir'], 'elixir');
}

// Keep original reference data, not megabytes of fonts, CSS, JS, search databases,
// or compiler caches. These are parser inputs, never public executable assets.
const { unlinkSync } = await import('node:fs');
manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const fixture of manifest.fixtures) {
  const base = join(output, fixture.language);
  for (const path of files(base)) {
    const rel = relative(base, path).replaceAll('\\', '/');
    const keep = fixture.adapter === 'sphinx' ? /\.fjson$/.test(rel)
      : fixture.adapter === 'docc' ? /^data\/.*\.json$/.test(rel)
      : ['typedoc', 'jsdoc'].includes(fixture.adapter) ? rel === 'api.json'
      : fixture.adapter === 'godoc' ? rel === 'api.txt'
      : fixture.adapter === 'docfx' ? /\.ya?ml$/.test(rel) && !/(?:toc|xrefmap)\.yml$/.test(rel)
      : ['doxygen', 'phpdoc'].includes(fixture.adapter) ? /\.xml$/.test(rel) && !/Doxyfile\.xml$/.test(rel)
      : /\.html$/.test(rel) && !/(?:src|static|help|legal|script|lib|resource|search|index-files|class-use|jquery|assets|.fingerprint)\//.test(rel) && !/^(?:search|allclasses|allpackages|index-all|help|deprecated-list|all-types|navigation)/.test(rel);
    if (!keep) unlinkSync(path);
  }
  fixture.output = files(base).map((path) => ({ path: relative(root, path), sha256: hash(path) }));
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Recorded ${manifest.fixtures.length} native-language fixtures.`);
