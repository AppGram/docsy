import { assertPublishConfirmation, releaseManifest } from './package.mjs';
const pkg = releaseManifest(process.cwd());
if (process.env.npm_config_dry_run !== 'true') assertPublishConfirmation(pkg);
console.log('Release manifest verified. Registry publication is a separate explicit action.');
