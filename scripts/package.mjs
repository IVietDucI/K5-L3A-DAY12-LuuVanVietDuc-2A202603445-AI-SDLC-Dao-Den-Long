import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from '../package.json' with { type: 'json' }

const root = fileURLToPath(new URL('../', import.meta.url))
const output = join(root, 'artifacts', `dao-den-long-v${manifest.version}.tar.gz`)
const prefix = resolve(tmpdir(), 'dao-cp4-release-')
const directory = mkdtempSync(prefix)
try {
  for (const [file, dest] of [
    ['dist', 'dist'], ['scripts/run.mjs', 'scripts/run.mjs'], ['scripts/server.mjs', 'scripts/server.mjs'],
    ['scripts/leaderboard-store.mjs', 'scripts/leaderboard-store.mjs'], ['src/leaderboard.js', 'src/leaderboard.js'],
    ['LICENSE', 'LICENSE'], ['CREDITS.md', 'CREDITS.md'], ['CHANGELOG.md', 'CHANGELOG.md'],
    ['node_modules/three/LICENSE', 'THREE-LICENSE'], ['docs/release.md', 'RUN.md'],
  ]) {
    const target = join(directory, dest)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(join(root, file), target, { recursive: true })
  }
  writeFileSync(join(directory, 'package.json'),
    JSON.stringify({ name: manifest.name, version: manifest.version, private: true, type: 'module' }, null, 2) + '\n')
  mkdirSync(dirname(output), { recursive: true })
  execFileSync(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-czf', output, '-C', directory, '.'])
  console.log(output)
  console.log(`SHA256 ${createHash('sha256').update(readFileSync(output)).digest('hex')}`)
} finally {
  if (directory.startsWith(prefix) && directory !== prefix) rmSync(directory, { recursive: true, force: true })
}
