import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { DEFAULT_INPUT, Simulation, TICK_RATE, fuelOf, tuning } from '../src/simulation.js'
import { replay, runCase, withTemp } from '../docs/proof/phase-3/replay.mjs'

const quiet = { random_motes: false, random_shades: false }
const event = (tick, name, data = {}) => ({ type: 'event', tick, name, data })
const drain = (tick, shade_id, fuel) => event(tick, 'fuel_drain', { lantern_id: 'L1', shade_id, fuel })

test('fuel at exactly 30 is safe and the next fuel unit below 30 is not', () => {
  const { at, events } = replay('fuel-threshold')
  assert.equal(at(1).lanterns[0].fuel, 30)
  assert.equal(at(2).lanterns[0].fuel, 30)
  assert.equal(at(1).player.flames, 3)
  assert.deepEqual(events, [event(2, 'player_hit', { by: 'shade', flames: 2, dropped: 0 })])
  const sim = new Simulation(12, { ...quiet, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 30 + 1 / 60 }] })
  sim.step()
  assert.equal(fuelOf(sim.lanterns[0]), 30)
  assert.equal(sim.playerInShelter(), true)
  sim.step()
  assert.equal(fuelOf(sim.lanterns[0]), 1799 / 60)
  assert.equal(sim.playerInShelter(), false)
})

test('two drains stack with natural decay, report once per 60 active ticks, and extinguish the lamp', () => {
  const { at, events } = replay('multi-drain')
  assert.deepEqual(events, [
    drain(60, 'S1', 14), drain(60, 'S2', 14), drain(120, 'S1', 3), drain(120, 'S2', 3),
    event(137, 'lantern_out', { lantern_id: 'L1' }),
  ])
  assert.deepEqual(at(60).shades, at(0).shades)
  assert.equal(at(136).lanterns[0].lit, true)
  assert.deepEqual(at(137).lanterns[0], {
    id: 'L1', pos: [0, 0, 0], lit: false, fuel: 0, deposited: 0, ever_lit: true, relit_count: 0,
  })
  assert.ok(at(137).shades.every(({ state }) => state === 'wander'))
})

test('Pulse stops future drain ticks and scores 15 for a drainer plus 5 for another shade', () => {
  const { at, events } = replay('pulse-drain')
  assert.deepEqual(events, [event(1, 'pulse', { stunned_ids: ['S1', 'S2'] })])
  assert.equal(at(1).lanterns[0].fuel, 9.9)
  assert.equal(at(60).lanterns[0].fuel, 8.9)
  assert.equal(at(1).score, 20)
  assert.equal(at(1).player.carried, 0)
  assert.ok(at(120).shades.every(({ state }) => state === 'stunned'))
  assert.ok(at(121).shades.every(({ state }) => state === 'wander'))
})

test('refueling stops drain, restores shelter, and expels the shade without damage', () => {
  const { at, events } = replay('refuel-shelter')
  assert.deepEqual(events, [event(1, 'refuel', { lantern_id: 'L1', amount: 1, fuel: 34.9 })])
  assert.equal(at(1).shades[0].state, 'wander')
  assert.equal(at(1).player.capacity, 10)
  assert.deepEqual(at(30).shades[0].pos, [6, .85, 0])
  assert.equal(at(30).player.flames, 3)

  const sim = new Simulation(12, { ...quiet, player: { carried: 1 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20.1 }],
    shades: [{ id: 'S1', pos: [.4, .85, 0], state: 'drain', target_lantern_id: 'L1' }] })
  assert.deepEqual(sim.step({ ...DEFAULT_INPUT, interact: true }), [event(1, 'refuel', { lantern_id: 'L1', amount: 1, fuel: 30 })])
  assert.equal(sim.playerInShelter(), true)
  sim.step()
  assert.equal(sim.playerInShelter(), false)
  for (let i = 2; i < 30; i++) assert.deepEqual(sim.step(), [])
  assert.deepEqual(sim.snapshot().shades[0].pos, [6, .85, 0])
  assert.equal(sim.player.flames, 3)
})

test('refuel uses exact missing fuel, clamps to 100 and skips a full lamp', () => {
  const { at, events } = replay('refuel-full')
  assert.deepEqual(events, [event(1, 'refuel', { lantern_id: 'L1', amount: 2, fuel: 100 })])
  assert.equal(at(1).player.carried, 1)
  assert.equal(at(1).score, 10)
  const sim = new Simulation(12, { ...quiet, player: { carried: 1 }, lanterns: [
    { id: 'L1', pos: [0, 0, 0], lit: true }, { id: 'L2', pos: [1, 0, 0], lit: true, fuel: 25 },
  ] })
  assert.equal(sim.nearbyLantern().id, 'L2')
  assert.deepEqual(sim.step({ ...DEFAULT_INPUT, interact: true }), [
    event(1, 'refuel', { lantern_id: 'L1', amount: 1, fuel: 100 }),
  ])
  assert.equal(sim.nearbyLantern().id, 'L2')
  const fractional = new Simulation(12, { ...quiet, player: { carried: 1 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 25 }] })
  assert.deepEqual(fractional.step({ ...DEFAULT_INPUT, interact: true }), [
    event(1, 'refuel', { lantern_id: 'L1', amount: 1, fuel: 2099 / 60 }),
  ])
  assert.equal(fractional.snapshot().lanterns[0].fuel, 35)
})

test('a light that goes out may relight in the same tick and contributes to the capacity cap', () => {
  const { at, events, end } = replay('relight-cap')
  assert.equal(at(0).player.capacity, 18)
  assert.deepEqual(events, [
    event(1, 'lantern_out', { lantern_id: 'L1' }),
    event(1, 'deposit', { lantern_id: 'L1', amount: 5, deposited: 5 }),
    event(1, 'lantern_lit', { lantern_id: 'L1', relight: true }),
    event(17, 'deposit', { lantern_id: 'L2', amount: 10, deposited: 10 }),
    event(17, 'lantern_lit', { lantern_id: 'L2', relight: false }),
  ])
  assert.equal(at(1).lanterns[0].fuel, 100)
  assert.equal(at(1).lanterns[0].relit_count, 1)
  assert.equal(at(1).score, 65)
  assert.equal(at(1).player.capacity, 20)
  assert.equal(at(17).lanterns[1].fuel, 100)
  assert.equal(at(17).player.capacity, 20)
  assert.equal(end.score, 215)
})

test('a scenario light has fuel and history but adds no capacity; pickups honor capacity after a successful light', () => {
  const { at } = replay('capacity-pickup')
  assert.equal(at(0).lanterns[1].fuel, 100)
  assert.equal(at(0).lanterns[1].ever_lit, true)
  assert.equal(at(0).player.capacity, 10)
  assert.equal(at(1).player.capacity, 12)
  assert.equal(at(10).player.carried, 12)
  assert.equal(at(10).motes_active, 1)
  assert.equal(new Simulation(12, quiet, 2).capacity, 10)
  assert.equal(new Simulation(12, { ...quiet, player: { successful_lights: 15 } }).capacity, 20)
})

test('all 3 dawn thresholds use live lamps and exact remaining fuel for the winning bonus', () => {
  for (const [night, threshold, points] of [[1, 3, 450], [2, 4, 746], [3, 5, 895]]) {
    const { at, events, end } = replay(`dawn-n${night}`)
    assert.equal(at(0).score, 0)
    assert.equal(at(0).player.capacity, 10)
    assert.equal(at(1).lanterns.filter(({ lit }) => lit).length, threshold)
    assert.deepEqual(events, [event(1, 'game_over', { result: 'won', reason: 'dawn_survived' })])
    assert.deepEqual(end, { type: 'end', ticks: 1, state: 'won', score: points })
  }
  const out = replay('dawn-out')
  assert.deepEqual(out.events, [
    event(1, 'lantern_out', { lantern_id: 'L3' }),
    event(1, 'game_over', { result: 'lost', reason: 'dawn' }),
  ])
  assert.equal(out.end.score, 0)
  const justInTime = replay('dawn-light')
  assert.deepEqual(justInTime.events, [
    event(1, 'deposit', { lantern_id: 'L1', amount: 1, deposited: 10 }),
    event(1, 'lantern_lit', { lantern_id: 'L1', relight: false }),
    event(1, 'game_over', { result: 'won', reason: 'dawn_survived' }),
  ])
  assert.equal(justInTime.end.score, 703)
})

test('pausing freezes fuel and the scheduled drain report', () => {
  const { at, events } = replay('pause-fuel')
  assert.deepEqual(events, [event(6, 'paused'), event(21, 'resumed'), drain(75, 'S1', 22)])
  assert.equal(at(6).sim_tick, 5)
  assert.equal(at(20).sim_tick, 5)
  assert.equal(at(20).lanterns[0].fuel, at(5).lanterns[0].fuel)
  assert.equal(at(75).sim_tick, TICK_RATE)
})

test('wander prefers a weak lamp and breaks ties by ID while chase keeps tracking Mây', () => {
  const { at } = replay('wander-targets')
  assert.deepEqual(at(1).shades[0].pos, [-.067, .85, 0])
  assert.deepEqual(at(1).shades[1].pos, [0, .85, .167])
  assert.equal(at(44).shades[0].state, 'wander')
  assert.deepEqual(at(45).shades[0], { id: 'W', pos: [-3, .85, 0], state: 'drain' })
  assert.equal(at(46).shades[1].state, 'chase')
  const sim = new Simulation(12, { ...quiet, player: { pos: [0, 0, -22] }, shades: [{ pos: [0, .85, 22] }] })
  sim.step()
  assert.deepEqual(sim.snapshot().shades[0].pos, [0, .85, 22.067])
})

test('drain exits on player radius 6 or when the target moves outside its 2 m range', () => {
  const { at } = replay('drain-exits')
  assert.equal(at(1).lanterns[0].fuel, 24.9)
  assert.equal(at(1).lanterns[1].fuel, 25)
  assert.equal(at(1).shades[0].state, 'chase')
  assert.equal(at(1).shades[1].state, 'wander')
})

test('a scenario targeting a nonexistent lamp is rejected as a CLI input error', () => {
  withTemp((path) => {
    const result = runCase('invalid-target', path)
    assert.equal(result.status, 2)
    assert.match(result.stderr, /target_lantern_id is unknown/)
    assert.equal(existsSync(path), false)
  })
})

test('the default Đảo Bến can be maintained until dawn under v1.2 rules', () => {
  const { at, events, end } = replay('night1-survival')
  const dawn = at(14400)
  assert.equal(dawn.player.flames, 3)
  assert.deepEqual(dawn.lanterns.filter(({ lit }) => lit).map(({ id }) => id), ['L1', 'L2', 'L3'])
  assert.ok(events.some(({ name }) => name === 'refuel'))
  assert.deepEqual(events.at(-1), event(14400, 'game_over', { result: 'won', reason: 'dawn_survived' }))
  assert.deepEqual(end, { type: 'end', ticks: 14400, state: 'won', score: 1000 })
})
