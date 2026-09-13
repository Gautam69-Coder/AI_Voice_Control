const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const builderCli = path.resolve(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js');
const electronDir = path.resolve(__dirname, '..', 'electron');

console.log(`[build_electron] Running electron-builder in ${electronDir} with args:`, args.join(' '));

const result = spawnSync('node', [builderCli, ...args], {
  cwd: electronDir,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error('[build_electron] Error:', result.error);
  process.exit(1);
}

process.exit(result.status || 0);
