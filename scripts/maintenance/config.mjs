import { z } from 'zod';

export const relativePath = (value) => typeof value === 'string'
  && value.length > 0 && !value.startsWith('/') && !value.includes('\\')
  && !value.split('/').some((part) => part === '..' || part === '.' || part === '.git')
  && !/[\x00-\x1f]/.test(value);

const glob = z.string().refine((value) => relativePath(value) && !/[\[\]{}!]/.test(value),
  'Use a relative path with *, **, or ? wildcards.');

export const maintenanceSchema = z.object({
  enabled: z.boolean().default(false),
  watch: z.array(glob).min(1).default(['sources/**', 'src/**']),
  docs: z.array(glob).min(1).default(['content/**/*.md', 'README.md']),
  ignore: z.array(glob).default([]),
  breakingChangesFile: z.string().refine((value) => relativePath(value) && value.endsWith('.md'),
    'Use a relative Markdown file path.').default('content/maintenance/breaking-changes.md'),
  maxDiffChars: z.number().int().min(1000).max(200_000).default(60_000),
  model: z.string().regex(/^[a-zA-Z0-9._:/-]+$/).optional(),
}).default({});

export const matchesGlob = (path, pattern) => {
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      index += 1;
      if (pattern[index + 1] === '/') { expression += '(?:.*/)?'; index += 1; }
      else expression += '.*';
    } else if (character === '*') expression += '[^/]*';
    else if (character === '?') expression += '[^/]';
    else expression += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${expression}$`).test(path);
};

export const matchesAny = (path, patterns) => patterns.some((pattern) => matchesGlob(path, pattern));
