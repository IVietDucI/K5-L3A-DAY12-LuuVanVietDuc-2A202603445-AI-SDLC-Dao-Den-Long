import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { arch, cpus, platform, release } from 'node:os'
import { performance } from 'node:perf_hooks'

const dir = 'docs/proof/phase-2/'
export const cases = JSON.parse(readFileSync(new URL('cases.json', import.meta.url), 'utf8'))

export function runCase(name, out) {
  const { night, ticks, every, scenario, inputs } = cases[name]
  const args = ['src/headless.js', '--seed', '12', '--night', String(night),
    '--ticks', String(ticks), '--snapshot-every', String(every), '--out', out]
  if (scenario) args.push('--scenario', scenario)
  if (inputs) args.push('--inputs', inputs)
  const start = performance.now()
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' })
  const elapsedMs = performance.now() - start
  assert.ifError(result.error)
  return { ...result, command: ['node', ...args].join(' '), elapsedMs }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2)
  for (const name of names.length ? names : Object.keys(cases)) {
    assert.ok(Object.hasOwn(cases, name), `Unknown case ${name}`)
    const out = `${dir}${name}.jsonl`
    const result = runCase(name, out)
    console.log(`${name}: exit ${result.status}, ${result.elapsedMs.toFixed(1)} ms`)
    if (name === 'invalid') {
      assert.equal(result.status, 2)
      writeFileSync(`${dir}validation.log`, `${result.command}\nexit=${result.status}\n${result.stderr}`)
      continue
    }
    assert.equal(result.status, 0, result.stderr)
    if (name === 'full-night') {
      const lines = readFileSync(out, 'utf8').trimEnd().split('\n').map(JSON.parse)
      const end = lines.at(-1)
      const lastSnapshot = lines.filter(({ type }) => type === 'snapshot').at(-1)
      assert.equal(end.ticks, 21600)
      assert.ok(result.elapsedMs <= 30000)
      writeFileSync(`${dir}headless-performance.json`, JSON.stringify({
        command: result.command, elapsed_ms: Math.round(result.elapsedMs * 100) / 100, target_ms: 30000,
        node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model,
        end, workload: { motes: lastSnapshot.motes.length, shades: lastSnapshot.shades.length,
          drifters: lastSnapshot.drifters.length, wind: lastSnapshot.wind },
      }, null, 2) + '\n')
    }
  }
}
