import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import contract from '../game.contract.json' with { type: 'json' }
import { benchmarkCamera, createBenchmark, frameStats, stepBenchmark } from '../src/benchmark-model.js'
import { activeKeys, bindingError, defaultKeys, loadKeys } from '../src/keymap.js'
import { validName } from '../src/leaderboard.js'
import { fuelOf } from '../src/simulation.js'
import { saveEntry } from '../scripts/leaderboard-store.mjs'

test('v1.3 commands and fixed benchmark scene preserve simulation state except ordinary wander', () => {
  for (const command of ['run_cmd', 'bench_cmd', 'soak_cmd']) assert.match(contract[command], /^node /)
  const sim = createBenchmark(42)
  const equal = createBenchmark(42)
  assert.equal(sim.night, 1)
  assert.deepEqual(sim.player.pos, [0, 0, 0])
  assert.equal(sim.shades.length, 200)
  assert.equal(sim.motes.length, 100)
  assert.equal(new Set(sim.shades.map(({ pos }) => pos.join(','))).size, 200)
  assert.deepEqual(sim.shades, equal.shades)
  assert.notDeepEqual(sim.shades, createBenchmark(43).shades)
  assert.deepEqual(sim.lanterns.map(fuelOf), [100, 100, 100, 0, 0])
  const original = sim.shades.map(({ pos }) => pos)
  for (let i = 0; i < 900; i++) stepBenchmark(sim)
  assert.notDeepEqual(sim.shades.map(({ pos }) => pos), original)
  assert.ok(sim.shades.every(({ state }) => state === 'wander'))
  assert.deepEqual(sim.lanterns.map(fuelOf), [100, 100, 100, 0, 0])
  assert.deepEqual(sim.player, equal.player)
  assert.deepEqual(sim.motes, equal.motes)
  assert.equal(sim.timeLeft, equal.timeLeft)
  assert.equal(sim.ended, false)
  assert.deepEqual(benchmarkCamera(0), [30, 15, -0])
  const quarter = benchmarkCamera(3.75)
  assert.ok(Math.abs(quarter[0]) < 1e-9)
  assert.deepEqual(quarter.slice(1), [15, -30])
  assert.ok(Math.abs(benchmarkCamera(15)[2]) < 1e-9)
})

test('benchmark metrics use the actual sum, nearest-rank p95 and ceil worst 1%', () => {
  const metrics = frameStats([70, 40, ...Array(99).fill(10)])
  assert.equal(metrics.frames, 101)
  assert.equal(metrics.avg_fps, 101000 / 1100)
  assert.equal(metrics.p1_low_fps, 1000 / 55)
  assert.equal(metrics.frame_ms_p95, 10)
  assert.throws(() => frameStats([]), /No complete frames/)
})

test('all nine key bindings persist with validation and aliases cannot shadow explicit keys', () => {
  const bindings = loadKeys({ ...defaultKeys, jump: 'ArrowUp', pause: 'KeyO' })
  assert.deepEqual(activeKeys(bindings, 'jump'), ['ArrowUp'])
  assert.deepEqual(activeKeys(bindings, 'forward'), ['KeyW'])
  assert.deepEqual(activeKeys(bindings, 'pause'), ['KeyO'])
  assert.match(bindingError(bindings, 'dash', 'KeyE'), /đã dùng/u)
  assert.equal(bindingError(bindings, 'dash', 'KeyG'), '')
  assert.deepEqual(loadKeys({ ...bindings, left: bindings.back }), defaultKeys)
  assert.equal(Object.keys(bindings).length, 9)
})

test('leaderboard keeps only top 10, orders ties chronologically and exports saved scores in a later process', () => {
  const prefix = resolve(tmpdir(), 'dao-cp4-board-test-')
  const directory = mkdtempSync(prefix)
  const path = join(directory, 'leaderboard.json')
  const out = join(directory, 'export.json')
  const entry = (name, score, achieved_at) => ({ name, score, achieved_at, nights_won: 2, seed: 42 })
  try {
    assert.ok(validName('May_123'))
    for (const name of ['ab', 'Mây', 'a b', 'xxxxxxxxxxxxx']) assert.ok(!validName(name))
    for (let i = 0; i < 12; i++) saveEntry(entry(`May${i}`, i, '2026-11-20T07:00:00Z'), path)
    saveEntry(entry('Later', 11, '2026-11-20T14:01:00+07:00'), path)
    saveEntry(entry('Earlier', 11, '2026-11-20T13:59:00+07:00'), path)
    execFileSync(process.execPath, ['scripts/run.mjs', '--export-leaderboard', out], {
      env: { ...process.env, DAO_DATA_DIR: directory },
    })
    const { entries } = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(entries.length, 10)
    assert.deepEqual(entries.slice(0, 3).map(({ name }) => name), ['Earlier', 'May11', 'Later'])
    assert.deepEqual(entries[0], entry('Earlier', 11, '2026-11-20T13:59:00+07:00'))
    assert.equal(entries.at(-1).score, 4)
  } finally {
    if (directory.startsWith(prefix) && directory !== prefix) rmSync(directory, { recursive: true, force: true })
  }
})

test('soak CLI writes real per-night results and rejects invalid arguments', () => {
  const prefix = resolve(tmpdir(), 'dao-cp4-soak-test-')
  const directory = mkdtempSync(prefix)
  const out = join(directory, 'soak.json')
  const flags = ['--jitless', '--expose-gc', 'scripts/soak.mjs']
  try {
    execFileSync(process.execPath, [...flags, '--seed', '7', '--nights', '3', '--out', out], { stdio: 'pipe' })
    const result = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(result.nights, 3)
    assert.equal(result.crashes, 0)
    assert.ok(result.results.every(state => ['won', 'lost'].includes(state)))
    assert.equal(result.results.length, 3)
    assert.ok(result.duration_s > 0 && result.mem_start_mb > 0 && result.mem_end_mb > 0)
    assert.equal(spawnSync(process.execPath, [...flags, '--seed', '7', '--nights', '0', '--out', out]).status, 2)
  } finally {
    if (directory.startsWith(prefix) && directory !== prefix) rmSync(directory, { recursive: true, force: true })
  }
})
