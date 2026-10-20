import { resolve } from 'node:path';
import { confirmation, packPackage } from './release/package.mjs';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Usage: npm run release:pack -- [--out <directory>]');
const output = resolve(args[1] || '.docsy/packages');
const artifact = packPackage(process.cwd(), output);
console.log(`Release candidate: ${confirmation(artifact)}\nTarball: ${resolve(output, artifact.filename)}\nSHA-256: ${artifact.sha256}\n\nCreate a site without publishing anything:\nnpm exec --package ${JSON.stringify(resolve(output, artifact.filename))} -- create-docsy my-docs --yes --ci\n\nThis only packs local files. No npm publication, GitHub release, tag or deployment was created.`);
