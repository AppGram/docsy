// Public YAML keys. Aliases are explicit; changing a label never adds a backend.
export const REQUEST_LANGUAGES = ['curl', 'javascript', 'typescript', 'node', 'python', 'go', 'java', 'kotlin', 'csharp', 'c', 'cpp', 'rust', 'swift', 'objectivec', 'dart', 'php', 'ruby', 'scala', 'elixir', 'lua', 'fsharp', 'visualbasic', 'powershell', 'r'] as const;
export type RequestLanguage = typeof REQUEST_LANGUAGES[number];
export const REQUEST_LABELS: Record<RequestLanguage, string> = {
  curl: 'cURL', javascript: 'JavaScript · fetch', typescript: 'TypeScript · fetch', node: 'Node.js · fetch', python: 'Python · requests', go: 'Go · net/http', java: 'Java · HttpClient', kotlin: 'Kotlin · OkHttp', csharp: 'C# · HttpClient', c: 'C · libcurl', cpp: 'C++ · libcurl', rust: 'Rust · reqwest', swift: 'Swift · URLSession', objectivec: 'Objective-C · NSURLSession', dart: 'Dart · http', php: 'PHP · cURL', ruby: 'Ruby · Net::HTTP', scala: 'Scala · Java HttpClient', elixir: 'Elixir · :httpc', lua: 'Lua · Lua-cURL', fsharp: 'F# · HttpClient', visualbasic: 'Visual Basic · HttpClient', powershell: 'PowerShell · Invoke-RestMethod', r: 'R · httr',
};
