import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const root = 'docs/proof/phase-3/'
const readManifest = (url) => JSON.parse(readFileSync(new URL(url, import.meta.url), 'utf8'))
const previous = readManifest('../phase-2/cases.json')
// The Phase 2 all-lit route ends too early for the replacement survival objective.
delete previous['night1-win']
export const cases = { ...previous, ...readManifest('cases.json') }

export function runCase(name, out) {
  const { night, ticks, every, scenario, inputs } = cases[name]
  const args = ['src/headless.js', '--seed', '12', '--night', String(night),
    '--ticks', String(ticks), '--snapshot-every', String(every), '--out', out]
  if (scenario) args.push('--scenario', scenario)
  if (inputs) args.push('--inputs', inputs)
  const start = performance.now()
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' })
  assert.ifError(result.error)
  return { ...result, command: ['node', ...args].join(' '), elapsedMs: performance.now() - start }
}

export function withTemp(run) {
  const temp = mkdtempSync(join(tmpdir(), 'dao-cp3-tests-'))
  const path = join(temp, 'run.jsonl')
  try {
    return run(path)
  } finally {
    if (existsSync(path)) unlinkSync(path)
    rmdirSync(temp)
  }
}

export function replay(name) {
  return withTemp((path) => {
    const result = runCase(name, path)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stderr, '')
    const bytes = readFileSync(path)
    assert.deepEqual(bytes, readFileSync(`${root}${name}.jsonl`), `Recorded v1.2 CLI output for ${name}`)
    const records = bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse)
    const snapshots = records.filter(({ type }) => type === 'snapshot')
    const events = records.filter(({ type }) => type === 'event')
    assert.equal(records[0].tick, 0)
    assert.deepEqual(events.shift(), { type: 'event', tick: 0, name: 'night_start', data: { night: records[0].night } })
    return { at: (tick) => snapshots.find((snapshot) => snapshot.tick === tick), snapshots, events, end: records.at(-1) }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2)
  for (const name of names.length ? names : Object.keys(cases)) {
    assert.ok(Object.hasOwn(cases, name), `Unknown case ${name}`)
    const out = `${root}${name}.jsonl`
    const result = runCase(name, out)
    const expected = cases[name].error ?? (name === 'invalid' ? 2 : 0)
    assert.equal(result.status, expected, result.stderr)
    console.log(`${name}: exit ${result.status}, ${result.elapsedMs.toFixed(1)} ms`)
    if (expected !== 0) {
      writeFileSync(`${root}${name}.log`, `${result.command}\nexit=${result.status}\n${result.stderr}`)
    } else if (name === 'full-night') {
      const lines = readFileSync(out, 'utf8').trimEnd().split('\n').map(JSON.parse)
      const end = lines.at(-1)
      const last = lines.filter(({ type }) => type === 'snapshot').at(-1)
      assert.equal(end.ticks, 18000)
      writeFileSync(`${root}headless-performance.json`, JSON.stringify({
        command: result.command, elapsed_ms: Math.round(result.elapsedMs * 100) / 100,
        node: process.version, platform: platform(), arch: arch(), release: release(), cpu: cpus()[0]?.model,
        end, workload: { motes: last.motes.length, shades: last.shades.length, drifters: last.drifters.length, wind: last.wind },
      }, null, 2) + '\n')
    }
  }
}
