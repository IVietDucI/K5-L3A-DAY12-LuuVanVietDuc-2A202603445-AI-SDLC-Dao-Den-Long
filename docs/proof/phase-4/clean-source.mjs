import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'
import { setTimeout as wait } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'
import { until, withChrome } from '../../../scripts/chrome.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const prefix = resolve(tmpdir(), 'dao-cp4-clean-')
const directory = mkdtempSync(prefix)
const source = join(directory, 'source')
const unpacked = join(directory, 'release')
const tar = process.platform === 'win32' ? 'tar.exe' : 'tar'
const log = []
let launcher
const record = value => { log.push(stripVTControlCharacters(value).replace(/[ \t]+$/gm, '')); console.log(value) }
function run(command, args, cwd = source) {
  record(`> ${[command, ...args].join(' ')}`)
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, NO_COLOR: '1' }, maxBuffer: 10 * 1024 * 1024 })
  if (result.stdout?.trim()) record(result.stdout.trimEnd())
  if (result.stderr?.trim()) record(result.stderr.trimEnd())
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} exited with ${result.status}`)
  return result.stdout
}

try {
  const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' })
  assert.equal(files.status, 0)
  for (const file of new Set(files.stdout.split('\0').filter(Boolean))) {
    if (!existsSync(join(root, file))) continue
    const target = join(source, file)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(join(root, file), target)
  }
  assert.ok(!['node_modules', 'dist', '.git'].some(name => existsSync(join(source, name))))
  record('Clean source snapshot from tracked and unignored working-tree files. node_modules, dist and .git are absent.')
  record(`Node ${process.version}; npm registry cache mode: ${process.env.npm_config_offline === 'true' ? 'offline' : 'default'}`)
  for (const args of [['ci'], ['test'], ['run', 'build'], ['run', 'package']]) {
    if (process.platform === 'win32') {
      run('cmd.exe', ['/d', '/c', 'npm.cmd', ...args])
    } else run('npm', args)
  }
  run(process.execPath, ['docs/proof/phase-3/replay.mjs'])
  const archive = join(source, 'artifacts', 'dao-den-long-v1.0.0.tar.gz')
  mkdirSync(unpacked)
  run(tar, ['-xzf', archive, '-C', unpacked])
  assert.ok(!existsSync(join(unpacked, 'node_modules')))
  launcher = spawn(process.execPath, ['scripts/run.mjs', '--no-open'], { cwd: unpacked, stdio: 'pipe',
    env: { ...process.env, DAO_PORT: '0', DAO_DATA_DIR: join(directory, 'score') } })
  const stdout = new Promise((resolve, reject) => {
    launcher.stdout.once('data', data => resolve(String(data)))
    launcher.once('error', reject)
    launcher.once('exit', code => reject(Error(`Release launcher exited with ${code}`)))
  })
  const banner = await Promise.race([stdout, wait(10000, undefined, { ref: false }).then(() => { throw Error('Release launcher timeout') })])
  record('> node scripts/run.mjs --no-open')
  record(banner.trim())
  const url = banner.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
  assert.ok(url)
  const index = await fetch(url)
  assert.equal(index.status, 200)
  const asset = (await index.text()).match(/<script type="module" [^>]*src="([^"]+)"/)?.[1]
  assert.ok(asset)
  assert.equal((await fetch(new URL(asset, url))).status, 200)
  const api = await fetch(new URL('api/leaderboard', url))
  assert.deepEqual(await api.json(), { entries: [] })
  record('Release smoke: HTTP 200 for index, compiled JS and leaderboard API, no npm dependencies installed.')
  await withChrome({ headless: true, software: true }, async ({ send, evaluate, version }) => {
    await send('Page.navigate', { url })
    await until(() => evaluate('document.querySelectorAll(".marker").length === 5').catch(() => false), 'release menu')
    await evaluate('document.querySelector("#round-button").click(); document.querySelector("#round-button").click()')
    await until(() => evaluate('!document.querySelector("#hud").hidden'), 'release gameplay HUD')
    assert.deepEqual(await evaluate('[document.querySelector("#world").width, document.querySelector("#world").height]'), [1280, 720])
    record(`Release browser smoke: ${version} / SwiftShader, menu to gameplay at 1280×720.`)
  })
  const target = join(root, 'artifacts', 'dao-den-long-v1.0.0.tar.gz')
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(archive, target)
  record(`Release SHA256 ${createHash('sha256').update(readFileSync(target)).digest('hex')}`)
} catch (error) {
  record(error.stack ?? error.message)
  process.exitCode = 1
} finally {
  if (launcher?.pid && launcher.exitCode === null && launcher.signalCode === null) {
    const closed = once(launcher, 'exit')
    launcher.kill()
    await closed
  }
  writeFileSync(new URL('clean-source.log', import.meta.url), log.join('\n') + '\n')
  if (directory.startsWith(prefix) && directory !== prefix) rmSync(directory, { recursive: true, force: true })
}
