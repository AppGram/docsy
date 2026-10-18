import { resolve } from 'node:path';
import { bundle, createConfig, lint } from '@redocly/openapi-core';

// Validate and bundle with the same engine in the CLI, dev server and build.
// Only configured sources are loaded; no request/query value becomes a file URL.
export async function readOpenApi(source: string, strict = true): Promise<Record<string, any>> {
  const ref = /^https?:\/\//i.test(source) ? source : resolve(process.cwd(), source);
  const config = await createConfig({
    extends: ['minimal'],
    rules: {
      struct: 'error',
      'no-unresolved-refs': 'error',
      'no-invalid-media-type-examples': 'error',
      'no-invalid-parameter-examples': 'error',
      'no-invalid-schema-examples': 'error',
    },
  });
  try {
    const problems = strict ? await lint({ ref, config }) : [];
    const result = await bundle({ ref, config, dereference: true });
    const errors = [...problems, ...result.problems].filter((problem) => problem.severity === 'error');
    if (errors.length) throw new Error([...new Set(errors.map((p) => `${p.ruleId}: ${p.message}`))].join('\n'));
    const spec = result.bundle.parsed as Record<string, any>;
    if (!spec || !(spec.openapi || spec.swagger) || !spec.info || !spec.paths) throw new Error('Expected an OpenAPI/Swagger document with info and paths.');
    return spec;
  } catch (error) {
    throw new Error(`Could not ingest OpenAPI source ${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
