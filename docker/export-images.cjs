// Run from the repository root: node docker/export-images.cjs [output.tar.gz]
const { spawn, execFileSync } = require('node:child_process');
const { createWriteStream, renameSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { createGzip } = require('node:zlib');
const { pipeline } = require('node:stream/promises');

async function main() {
  const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
  const destination = resolve(process.argv[2] || 'release/ctv-images.tar.gz');
  const partial = destination + '.partial';
  if (existsSync(destination) || existsSync(partial)) throw new Error('Output already exists; choose a new filename.');
  const images = [...new Set(execFileSync(docker, [
    'compose', '--env-file', 'release/.env.docker', '-f', 'release/compose.yaml', 'config', '--images',
  ], { encoding: 'utf8' }).trim().split(/\r?\n/))];
  const child = spawn(docker, ['save', ...images], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`docker save exited ${code}`)));
  });
  await Promise.all([
    completed,
    pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(partial, { flags: 'wx' })),
  ]);
  renameSync(partial, destination);
  console.log(`Exported ${images.length} images: ${destination}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
