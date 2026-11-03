/** Liga os hooks versionados em .githooks (sem dependência como husky). */
import { spawnSync } from 'node:child_process';

if (process.env['CI']) process.exit(0);
const dentroDoGit = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
if (dentroDoGit.stdout.trim() === 'true') {
  spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
}
