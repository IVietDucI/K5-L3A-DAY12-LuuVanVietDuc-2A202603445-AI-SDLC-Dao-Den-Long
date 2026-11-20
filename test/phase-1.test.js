import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import contract from '../game.contract.json' with { type: 'json' }
import { DEFAULT_INPUT, Simulation, tuning } from '../src/simulation.js'

const proof = 'docs/proof/phase-1/'

function run(headlessArgs) {
  const temp = mkdtempSync(join(tmpdir(), 'dao-den-long-'))
  const output = join(temp, 'output.jsonl')
  try {
    const [command, script] = contract.headless_cmd.split(' ')
    assert.equal(command, 'node')
    const result = spawnSync(process.execPath, [
      script, '--seed', '12', '--night', '1', ...headlessArgs, '--out', output,
    ], { encoding: 'utf8' })
    assert.ifError(result.error)
    const bytes = result.status === 0 ? readFileSync(output) : null
    return { ...result, bytes }
  } finally {
    if (existsSync(output)) unlinkSync(output)
    rmdirSync(temp)
  }
}

function parse(result) {
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  return result.bytes.toString('utf8').trimEnd().split('\n').map((line) => JSON.parse(line))
}

function replay(name, args) {
  const result = run(args)
  const lines = parse(result)
  assert.deepEqual(result.bytes, readFileSync(`${proof}${name}.jsonl`), 'proof must match the CLI output byte for byte')
  return lines
}

const events = (lines) => lines.filter(({ type }) => type === 'event')
const snapshots = (lines) => lines.filter(({ type }) => type === 'snapshot')
const event = (tick, name, data) => ({ type: 'event', tick, name, data })

test('movement, camera yaw, normalization, pickup, held input and jump', () => {
  const lines = replay('movement', [
    '--scenario', `${proof}movement.scenario.json`, '--inputs', `${proof}movement.inputs.json`,
    '--ticks', '12', '--snapshot-every', '4',
  ])
  const [start, cameraRelative, diagonal, jumping] = snapshots(lines)
  assert.deepEqual(start.player, { pos: [0, 0, 0], carried: 0, flames: 3 })
  assert.deepEqual(start.lanterns.map(({ id }) => id), ['L1', 'L2', 'L3', 'L4', 'L5'])
  assert.equal(start.score, 0)
  assert.equal(start.motes_active, 2)
  assert.deepEqual(start.shades, [])
  assert.deepEqual(snapshots(lines).map(({ tick, sim_tick }) => [tick, sim_tick]), [[0, 0], [4, 4], [8, 8], [12, 12]])
  assert.equal(cameraRelative.time_left_s, 120 - 4 / 60)
  assert.deepEqual(cameraRelative.player.pos, [0.367, 0, 0])
  assert.deepEqual(diagonal.player.pos, [0.626, 0, 0.259])
  assert.deepEqual(jumping.player.pos, [0.626, 0.337, 0.259])
  assert.deepEqual(events(lines), [event(1, 'mote_picked', { carried: 1 })])
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 12, state: 'playing', score: 10 })
})

test('last deposit at the inclusive radius lights L5, wins, and awards time and flame bonuses', () => {
  const lines = replay('last-lantern', [
    '--scenario', `${proof}last-lantern.scenario.json`, '--inputs', `${proof}last-lantern.inputs.json`,
    '--ticks', '5', '--snapshot-every', '1',
  ])
  const [start, end] = snapshots(lines)
  assert.equal(start.score, 0)
  assert.equal(start.motes_active, 0)
  assert.equal(start.lanterns.filter((lantern) => lantern.lit).length, 4)
  assert.deepEqual(events(lines), [
    event(1, 'deposit', { lantern_id: 'L5', amount: 2, deposited: 4 }),
    event(1, 'lantern_lit', { lantern_id: 'L5' }),
    event(1, 'game_over', { result: 'won', reason: 'all_lit' }),
  ])
  assert.equal(end.player.carried, 0)
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 1, state: 'won', score: 308 })
})

test('the first shade acts immediately, then hits again when immunity expires', () => {
  const lines = replay('collision', ['--scenario', `${proof}collision.scenario.json`, '--ticks', '100'])
  assert.equal(lines[0].shades[0].id, 'Bong-1')
  assert.equal(snapshots(lines)[1].player.carried, 5)
  assert.deepEqual(events(lines), [
    event(1, 'player_hit', { by: 'shade', flames: 1, dropped: 0 }),
    event(91, 'player_hit', { by: 'shade', flames: 0, dropped: 0 }),
    event(91, 'game_over', { result: 'lost', reason: 'no_flames' }),
  ])
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 91, state: 'lost', score: 0 })
})

test('Pulse uses XZ radius, spends motes, pushes and stuns for the advertised time', () => {
  const lines = replay('pulse', [
    '--scenario', `${proof}pulse.scenario.json`, '--inputs', `${proof}pulse.inputs.json`,
    '--ticks', '130', '--snapshot-every', '10',
  ])
  assert.deepEqual(events(lines), [
    event(1, 'pulse', { stunned_ids: ['S2'] }),
    event(102, 'pulse', { stunned_ids: ['S1'] }),
  ])
  const states = snapshots(lines)
  assert.deepEqual(states[1].shades[0], { id: 'S2', pos: [7.5, 0.85, 0], state: 'stunned' })
  assert.equal(states[1].player.carried, 4)
  assert.equal(states.find(({ tick }) => tick === 120).shades[0].state, 'stunned')
  assert.equal(states.at(-1).shades[0].state, 'chasing')
  assert.equal(states.at(-1).player.carried, 2)
  assert.equal(states.at(-1).player.flames, 3)
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 130, state: 'playing', score: 50 })
})

test('malformed inputs and scenario return 2 and explain the failure on stderr', () => {
  for (const [option, message] of [
    ['inputs', /strictly increasing/],
    ['scenario', /lantern ID/],
  ]) {
    const result = run([`--${option}`, `${proof}invalid.${option}.json`, '--ticks', '5'])
    assert.equal(result.status, 2)
    assert.match(result.stderr, message)
    assert.equal(result.stdout, '')
  }
})

test('two independent seeded CLI runs produce identical JSONL, including spawned shade IDs', () => {
  const args = ['--ticks', '380', '--snapshot-every', '60']
  const first = replay('seeded', args)
  const again = run(args)
  assert.equal(again.status, 0, again.stderr)
  assert.deepEqual(again.bytes, readFileSync(`${proof}seeded.jsonl`))
  assert.equal(first[0].motes_active, 32)
  assert.deepEqual(events(first), [event(360, 'shade_spawned', { id: 'S1' })])
  assert.equal(snapshots(first).at(-1).shades[0].id, 'S1')
})

test('a complete round with the default island, motes and shades is winnable', () => {
  const lines = replay('full-night', [
    '--inputs', `${proof}full-night.inputs.json`, '--ticks', '7200', '--snapshot-every', '180',
  ])
  const recorded = events(lines)
  assert.deepEqual(recorded.filter(({ name }) => name === 'lantern_lit').map(({ data }) => data.lantern_id),
    ['L1', 'L2', 'L3', 'L4', 'L5'])
  assert.equal(recorded.filter(({ name }) => name === 'shade_spawned').length, 3)
  assert.equal(recorded.filter(({ name }) => name === 'player_hit').length, 2)
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 1869, state: 'won', score: 926 })
})

test('dawn clamps time and stops a long request', () => {
  const lines = replay('dawn', ['--scenario', `${proof}dawn.scenario.json`, '--ticks', '300', '--snapshot-every', '2'])
  const [start, end] = snapshots(lines)
  assert.equal(start.time_left_s, 1 / 30)
  assert.equal(end.time_left_s, 0)
  assert.deepEqual(events(lines), [event(2, 'game_over', { result: 'lost', reason: 'dawn' })])
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 2, state: 'lost', score: 0 })
})

test('Mây is safe at the exact shelter boundary and the shade retreats', () => {
  const sim = new Simulation(12, {
    player: { pos: [tuning.safe_radius, 0, 0] },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    motes: [],
    shades: [{ pos: [tuning.safe_radius, 1, 0] }],
  })
  assert.deepEqual(sim.step(), [])
  assert.equal(sim.player.flames, tuning.flames)
  assert.ok(sim.shades[0].pos[0] > tuning.safe_radius)
})

test('holding interact does not deposit new motes until a new press', () => {
  const sim = new Simulation(12, {
    player: { carried: 1 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
    motes: [[1.2, 0, 0]],
    shades: [],
  })
  const input = { ...DEFAULT_INPUT, interact: true, move: [1, 0] }
  assert.deepEqual(sim.step(input), [event(1, 'deposit', { lantern_id: 'L1', amount: 1, deposited: 1 })])
  for (let tick = 2; tick <= 5; tick++) sim.step(input)
  assert.equal(sim.player.carried, 1)
  assert.equal(sim.lanterns[0].deposited, 1)
  sim.step()
  assert.deepEqual(sim.step(input), [event(7, 'deposit', { lantern_id: 'L1', amount: 1, deposited: 2 })])
})
