import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import contract from '../game.contract.json' with { type: 'json' }
import { DEFAULT_INPUT, Simulation, tuning } from '../src/simulation.js'
import { islands, surfacesAt } from '../src/islands.js'
import { replay, runCase, withTemp } from '../docs/proof/phase-3/replay.mjs'

const dir = 'docs/proof/phase-3/'
const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false }
const event = (tick, name, data = {}) => ({ type: 'event', tick, name, data })
const near = (a, b, delta = .001) => assert.ok(Math.abs(a - b) <= delta, `${a} differs from ${b}`)

test('v1.3 preserves night timing, geometry and arrays for all three nights', () => {
  assert.equal(contract.contract_version, '1.3')
  assert.equal(contract.headless_cmd, 'node src/headless.js')
  assert.equal(tuning.lantern_cost, 10)
  assert.equal(tuning.carry_capacity, 10)
  const durations = [240, 270, 300]
  const expected = Object.values(islands)
  const names = ['night1-spawn', 'night2-spawn', 'night3-spawn']
  for (const [index, name] of names.entries()) {
    const night = index + 1
    const { at } = replay(name)
    const initial = at(0)
    assert.equal(initial.night, night)
    assert.equal(initial.time_left_s, durations[index])
    assert.equal(initial.lanterns.length, night + 4)
    assert.deepEqual(initial.shades, [])
    assert.deepEqual(initial.drifters, [])
    assert.equal(initial.charms.length, index)
    assert.equal(initial.motes_active, 20)
    assert.equal(new Set(initial.motes.map(({ pos }) => pos.join(','))).size, 20)
    assert.equal(expected[index].moteSpots.length, night === 3 ? 30 : 24)
    assert.ok(initial.motes.every((mote) => mote.kind === 'random' && mote.ttl_s === null))
    assert.equal(at(240).motes_active, 21)
    const sim = new Simulation(12, empty, night)
    assert.deepEqual(sim.lanterns.map(({ pos }) => pos), expected[index].lanterns)
    assert.deepEqual(sim.charms.map(({ pos }) => pos), expected[index].charms)
  }
  assert.deepEqual(islands[2].lanterns.at(-1), [53, 0, -10])
  assert.deepEqual(islands[3].lanterns[0], [0, 6, 6])
})

test('CP1 movement regression preserves initial state and snapshot cadence', () => {
  const { at, snapshots, events, end } = replay('movement')
  const { pos, carried, flames } = at(0).player
  assert.deepEqual({ pos, carried, flames }, { pos: [0, 0, 0], carried: 0, flames: 3 })
  assert.deepEqual(at(0).lanterns.map(({ id }) => id), ['L1', 'L2', 'L3', 'L4', 'L5'])
  assert.equal(at(0).score, 0)
  assert.equal(at(0).motes_active, 2)
  assert.deepEqual(at(0).shades, [])
  assert.deepEqual(snapshots.map(({ tick, sim_tick }) => [tick, sim_tick]), [[0, 0], [4, 4], [8, 8], [12, 12]])
  assert.deepEqual(at(4).player.pos, [.4, 0, 0])
  assert.deepEqual(at(8).player.pos, [.683, 0, .283])
  assert.deepEqual(at(12).player.pos, [.683, .422, .283])
  assert.equal(at(4).time_left_s, 240 - 4 / 60)
  assert.deepEqual(events, [event(1, 'mote_picked', { carried: 1 })])
  assert.deepEqual(end, { type: 'end', ticks: 12, state: 'playing', score: 0 })
})

test('pickup requires XZ <= 1 and Y gap <= 1.5 without scoring on pickup', () => {
  const { at, events } = replay('pickup-height')
  assert.deepEqual(events, [event(1, 'mote_picked', { carried: 1 })])
  assert.equal(at(2).motes.length, 2)
  assert.equal(at(2).score, 0)
})

test('CP1 deposit regression honors ties, edge presses, partial amounts and the new score', () => {
  const { at, events } = replay('partial-deposit')
  assert.deepEqual(events, [
    event(1, 'deposit', { lantern_id: 'L1', amount: 1, deposited: 7 }),
    event(3, 'mote_picked', { carried: 1 }),
    event(5, 'deposit', { lantern_id: 'L1', amount: 1, deposited: 8 }),
  ])
  assert.equal(at(5).score, 10)
  assert.equal(at(5).lanterns[1].deposited, 0)
})

test('elevation does not affect the inclusive 2 m XZ deposit while Pulse uses 3D', () => {
  const { at, events } = replay('deposit-height')
  assert.deepEqual(at(0).player.pos, [0, 0, 8])
  assert.deepEqual(at(0).lanterns[0].pos, [0, 6, 6])
  assert.deepEqual(events, [
    event(1, 'pulse', { stunned_ids: ['edge'] }),
    event(2, 'deposit', { lantern_id: 'L1', amount: 2, deposited: 10 }),
    event(2, 'lantern_lit', { lantern_id: 'L1', relight: false }),
    event(4, 'refuel', { lantern_id: 'L1', amount: 1, fuel: 100 }),
  ])
  assert.equal(at(1).shades[0].state, 'stunned')
  assert.notEqual(at(1).shades[1].state, 'stunned')
  assert.equal(at(4).lanterns[1].deposited, 0)
  assert.equal(at(4).player.carried, 0)
  assert.equal(at(4).score, 120)
})

test('the final inclusive-range deposit wins at dawn unless no flames remain', () => {
  const won = replay('final-lantern')
  assert.deepEqual(won.events, [
    event(1, 'deposit', { lantern_id: 'L5', amount: 2, deposited: 10 }),
    event(1, 'lantern_lit', { lantern_id: 'L5', relight: false }),
    event(1, 'game_over', { result: 'won', reason: 'dawn_survived' }),
  ])
  assert.equal(won.at(1).time_left_s, 0)
  assert.deepEqual(won.end, { type: 'end', ticks: 1, state: 'won', score: 1006 })

  const timed = replay('timed-win')
  assert.equal(timed.at(0).score, 0)
  assert.equal(timed.at(0).motes_active, 0)
  assert.equal(timed.at(0).lanterns.filter(({ lit }) => lit).length, 4)
  assert.deepEqual(timed.events, won.events.slice(0, 2))
  assert.equal(timed.at(1).player.carried, 0)
  assert.equal(timed.at(1).player.flames, 2)
  assert.equal(timed.at(1).time_left_s, 30 - 1 / 60)
  assert.equal(timed.at(5).lanterns.every(({ lit }) => lit), true)
  assert.deepEqual(timed.end, { type: 'end', ticks: 5, state: 'playing', score: 110 })

  const lost = replay('priority')
  assert.deepEqual(lost.events, [
    event(1, 'player_hit', { by: 'fall', flames: 0, dropped: 0, lost: 6 }),
    event(1, 'game_over', { result: 'lost', reason: 'no_flames' }),
  ])
  const dawn = replay('dawn')
  assert.equal(dawn.at(0).time_left_s, 1 / 30)
  assert.equal(dawn.at(2).time_left_s, 0)
  assert.deepEqual(dawn.events, [event(2, 'game_over', { result: 'lost', reason: 'dawn' })])
  assert.deepEqual(dawn.end, { type: 'end', ticks: 2, state: 'lost', score: 0 })
})

test('pause counts wall ticks while freezing movement, cooldowns, invulnerability and TTL', () => {
  const { at, events } = replay('pause-dash')
  assert.deepEqual(events, [event(1, 'dash'), event(4, 'paused'), event(17, 'resumed'), event(104, 'dash')])
  for (const tick of [4, 16]) {
    const paused = at(tick)
    assert.equal(paused.state, 'paused')
    assert.equal(paused.sim_tick, 3)
    assert.equal(paused.time_left_s, at(3).time_left_s)
    assert.deepEqual(paused.player, at(3).player)
    assert.deepEqual(paused.motes, at(3).motes)
  }
  assert.equal(at(17).sim_tick, 4)
  assert.deepEqual(at(25).player.pos, [2.8, 1, 0])
  assert.equal(at(25).player.vel[1], 0)
  assert.equal(at(26).player.pos[1], .997)
  assert.equal(at(68).motes.length, 0)
  assert.equal(at(104).sim_tick, 91)
  const sim = new Simulation(12, empty)
  sim.step({ ...DEFAULT_INPUT, dash: true })
  assert.deepEqual(sim.snapshot().player.vel, [0, 0, 14])
  const spawning = new Simulation(12, { player: { charm_ticks: 600 }, random_shades: false })
  for (let i = 0; i < 239; i++) spawning.step()
  const charmBefore = spawning.player.charm
  spawning.step({ ...DEFAULT_INPUT, pause: true })
  for (let i = 0; i < 10; i++) spawning.step()
  assert.equal(spawning.simTick, 239)
  assert.equal(spawning.motes.length, 20)
  assert.equal(spawning.player.charm, charmBefore)
  spawning.step({ ...DEFAULT_INPUT, pause: true })
  assert.equal(spawning.simTick, 240)
  assert.equal(spawning.motes.length, 21)
})

test('fall ignores invulnerability, loses the entire bag once, then respawns after 60 ticks', () => {
  const { at, events } = replay('fall')
  assert.deepEqual(events, [event(1, 'player_hit', { by: 'fall', flames: 1, dropped: 0, lost: 7 })])
  assert.ok(at(60).player.pos[1] < -10)
  assert.deepEqual(at(61).player.pos, [0, 0, 0])
  assert.deepEqual(at(61).player.vel, [0, 0, 0])
  assert.equal(at(61).player.carried, 0)
  assert.equal(at(61).player.invuln, true)
})

test('Đảo Cau bridge bounds and launch preserve velocity until landing on the other island', () => {
  assert.deepEqual(surfacesAt(islands[2], 35, 2), [{ y: 0 }])
  assert.deepEqual(surfacesAt(islands[2], 35, 2.001), [])
  const bridge = replay('bridge')
  assert.deepEqual(bridge.at(25).player.pos, [44.4, 0, 1.99])
  const pad = replay('pad-cau')
  near(Math.hypot(pad.at(5).player.vel[0], pad.at(5).player.vel[2]), 24)
  assert.ok(pad.at(45).player.pos[1] > 4.8)
  assert.deepEqual(pad.at(90).player.pos, [51.594, 0, 7.163])
  assert.equal(pad.at(90).player.grounded, true)
  const reverse = new Simulation(12, { ...empty, player: { pos: [50, 0, -18] } }, 2)
  for (let i = 0; i < 85; i++) reverse.step()
  assert.equal(reverse.player.grounded, true)
  assert.ok(Math.hypot(reverse.player.pos[0], reverse.player.pos[2]) <= 28)
})

test('Đảo Chuông levels, both ramps, tower wall and launch produce the correct landings', () => {
  const island = islands[3]
  assert.deepEqual(surfacesAt(island, 0, 18).map(({ y }) => y), [0, 3])
  assert.deepEqual(surfacesAt(island, 0, -18).map(({ y }) => y), [0])
  assert.deepEqual(surfacesAt(island, 8, 0).map(({ y }) => y), [0, 6])
  assert.deepEqual(replay('ramp').at(75).player.pos, [19.659, 3, 11.35])
  const pad = replay('pad-chuong')
  assert.equal(pad.at(55).player.pos[1], 6)
  assert.equal(pad.at(55).player.grounded, true)
  const reverse = new Simulation(12, { ...empty, player: { pos: [-Math.sqrt(3) * 15.1, 0, 15.1] } }, 3)
  for (let i = 0; i < 75; i++) reverse.step({ ...DEFAULT_INPUT, move: [0, -1], cam_yaw_deg: -60 })
  assert.equal(reverse.player.pos[1], 3)
  const tower = new Simulation(12, { ...empty, player: { pos: [0, 6, 2.2] } }, 3)
  for (let i = 0; i < 10; i++) tower.step({ ...DEFAULT_INPUT, move: [0, -1] })
  near(tower.player.pos[2], 2)
  assert.equal(tower.player.grounded, true)
  const drop = new Simulation(12, { ...empty, player: { pos: [0, 6, -7.9] } }, 3)
  for (let i = 0; i < 60; i++) drop.step({ ...DEFAULT_INPUT, move: [0, -1] })
  assert.equal(drop.player.pos[1], 0)
  assert.equal(drop.player.flames, 3)
})

test('wind activates at simulation tick 1800 and delivers 2 m/s for 300 ticks', () => {
  const { at } = replay('wind')
  assert.equal(at(1740).wind.active, false)
  assert.equal(at(1800).wind.active, true)
  assert.equal(at(1800).wind.dir_deg, at(1740).wind.dir_deg)
  near(Math.hypot(at(1800).player.vel[0], at(1800).player.vel[2]), 2)
  assert.equal(at(2100).wind.active, false)
  near(Math.hypot(at(2100).player.pos[0] - 20, at(2100).player.pos[2] + 25), 10)
})

test('Pulse locks 3D targets, pushes 4 m in 15 ticks and resets a stunned shade', () => {
  const { at, events, end } = replay('pulse')
  assert.deepEqual(events, [
    event(1, 'pulse', { stunned_ids: ['edge', 'same'] }),
    event(181, 'pulse', { stunned_ids: ['same'] }),
  ])
  assert.equal(at(5).shades[0].pos[0], 4.333)
  assert.deepEqual(at(15).shades.map(({ pos }) => pos), [[7, 4.8, 0], [0, 5.801, 0], [4, .8, 0]])
  assert.equal(at(120).shades[2].state, 'stunned')
  assert.equal(at(125).shades[2].state, 'chase')
  assert.equal(at(185).player.carried, 1)
  assert.equal(at(185).player.flames, 3)
  assert.equal(at(15).score, 10)
  assert.deepEqual(end, { type: 'end', ticks: 185, state: 'playing', score: 15 })
  const wall = replay('pulse-wall')
  assert.deepEqual(wall.events, [event(1, 'pulse', { stunned_ids: ['S1'] })])
  assert.equal(wall.at(15).shades[0].pos[0], -2)
})

test('Bóng Mực evicts to the safe boundary within 30 ticks and cannot cross it', () => {
  const { at, events } = replay('shelter')
  assert.deepEqual(events, [event(1, 'deposit', { lantern_id: 'L1', amount: 10, deposited: 10 }),
    event(1, 'lantern_lit', { lantern_id: 'L1', relight: false })])
  assert.deepEqual(at(5).shades[0].pos, [1, .8, 0])
  assert.deepEqual(at(30).shades[0].pos, [6, .8, 0])
  assert.equal(at(30).player.flames, 3)
  const sim = new Simulation(12, { ...empty, player: { pos: [6, 0, 0] },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [6.01, .85, 0] }] })
  assert.equal(sim.playerInShelter(), true)
  assert.deepEqual(sim.step(), [])
  near(sim.shades[0].pos[0], 6)
  assert.equal(sim.player.flames, 3)
})

test('shade contact honors ID, height and immunity, with 60 recoil steps and drop TTL', () => {
  const { at, events } = replay('recoil')
  assert.deepEqual(events[0], event(1, 'player_hit', { by: 'shade', flames: 2, dropped: 3 }))
  assert.equal(at(1).shades.find(({ id }) => id === 'S2').state, 'recoil')
  assert.equal(at(1).shades.find(({ id }) => id === 'S4').state, 'chase')
  assert.equal(at(61).shades.find(({ id }) => id === 'S2').pos[0], 2)
  assert.equal(at(90).player.invuln, true)
  assert.equal(events[1].tick, 91)
  for (const mote of at(1).motes) {
    const dist = Math.hypot(mote.pos[0], mote.pos[2])
    assert.ok(dist >= 1.499 && dist <= 2.501)
    assert.equal(mote.kind, 'dropped')
    assert.equal(mote.ttl_s, 8)
  }
  const sim = new Simulation(12, { ...empty, player: { pos: [15, 0, -12] },
    shades: [{ pos: [3, .85, -12] }] }, 3)
  sim.step()
  near(sim.shades[0].pos[0], 3.075)
})

test('CP1 configured shade hits on tick 1, hits at immunity expiry and causes flame loss', () => {
  const { at, events, end } = replay('shade-loss')
  assert.equal(at(0).shades[0].id, 'Bong-1')
  assert.equal(at(1).player.carried, 3)
  assert.equal(at(90).player.invuln, true)
  assert.deepEqual(events, [
    event(1, 'player_hit', { by: 'shade', flames: 1, dropped: 2 }),
    event(91, 'player_hit', { by: 'shade', flames: 0, dropped: 1 }),
    event(91, 'game_over', { result: 'lost', reason: 'no_flames' }),
  ])
  assert.equal(at(91).player.carried, 2)
  assert.deepEqual(end, { type: 'end', ticks: 91, state: 'lost', score: 0 })

  const cp1 = JSON.parse(readFileSync('docs/proof/phase-1/collision.scenario.json', 'utf8'))
  const sim = new Simulation(12, cp1)
  assert.deepEqual(sim.step(), [])
  assert.equal(sim.player.flames, 2)
  assert.equal(sim.player.carried, 5)
})

test('Gió Lạc steals before the hit, drops recovered motes on Pulse and disappears on schedule', () => {
  const { at, events } = replay('steal-drop')
  assert.deepEqual(events.slice(0, 4), [
    event(1, 'drifter_steal', { drifter_id: 'D1', amount: 3, carried: 6 }),
    event(1, 'player_hit', { by: 'shade', flames: 2, dropped: 3 }),
    event(2, 'pulse', { stunned_ids: ['S1'] }),
    event(2, 'drifter_drop', { drifter_id: 'D1', amount: 3 }),
  ])
  assert.equal(at(2).motes.length, 6)
  assert.equal(at(3).player.carried, 3)
  assert.equal(at(121).drifters[0].stolen, 0)
  assert.deepEqual(at(122).drifters, [])
  const repelled = replay('drifter-repel')
  assert.deepEqual(repelled.events, [event(1, 'pulse', { stunned_ids: [] })])
  assert.equal(repelled.at(2).drifters[0].state, 'flee')
  assert.deepEqual(repelled.at(242).drifters, [])
  const sheltered = new Simulation(12, { ...empty, player: { carried: 5, invuln_ticks: 10 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    drifters: [{ pos: [1.2 + 7 / 60, .85, 0] }] }, 2)
  assert.deepEqual(sheltered.step(), [event(1, 'drifter_steal', { drifter_id: 'D1', amount: 3, carried: 2 })])
  assert.equal(sheltered.player.flames, 3)
})

test('Bùa Gió permits an edge-pressed second dash, boosts run and respawns after 2700 ticks', () => {
  const { at, events } = replay('charm')
  assert.deepEqual(events, [
    event(1, 'charm_picked', { charm_id: 'C1', charm_ticks: 600 }),
    event(2, 'dash'), event(15, 'dash'),
  ])
  assert.equal(at(5).player.dash_cd_s, 0)
  assert.equal(at(600).player.charm_s, 1 / 60)
  assert.equal(at(605).player.charm_s, 0)
  assert.equal(at(2700).charms[0].available, false)
  assert.equal(at(2705).charms[0].available, true)
  const sim = new Simulation(12, { ...empty, player: { charm_ticks: 600 } }, 2)
  sim.step({ ...DEFAULT_INPUT, move: [0, 1] })
  assert.equal(sim.snapshot().player.vel[2], 7.2)
})

test('spawn schedules differ by night and new motes and shades only act next tick', () => {
  for (const [night, interval] of [480, 420, 360].entries()) {
    const result = replay(`night${night + 1}-spawn`)
    assert.deepEqual(result.events.slice(0, 3), [
      event(300, 'shade_spawned', { id: 'S1' }), event(300, 'shade_spawned', { id: 'S2' }),
      event(300 + interval, 'shade_spawned', { id: 'S3' }),
    ])
    assert.ok(result.at(300).shades.every(({ state }) => state === 'spawning'))
  }
  assert.equal(replay('night2-spawn').at(1200).drifters[0].id, 'D1')
  const pickup = replay('spawn-pickup')
  assert.ok(pickup.at(240).motes.some(({ id }) => id === 'M21'))
  assert.deepEqual(pickup.events, [event(241, 'mote_picked', { carried: 1 })])
  const pulse = replay('spawn-pulse')
  assert.equal(pulse.at(300).shades[0].state, 'spawning')
  assert.deepEqual(pulse.events[2], event(301, 'pulse', { stunned_ids: ['S1'] }))
  assert.equal(pulse.at(301).shades[0].state, 'stunned')
})

test('errors return code 2 for v1.1 controls and for the retained CP1 invalid fixtures', () => {
  withTemp((path) => {
    const invalid = runCase('invalid', path)
    assert.equal(invalid.status, 2)
    assert.match(invalid.stderr, /dash must be a boolean/)
    for (const [kind, message] of [['inputs', /strictly increasing/], ['scenario', /lantern ID/]]) {
      const result = spawnSync(process.execPath, ['src/headless.js', '--seed', '12', '--night', '1',
        '--ticks', '3', '--out', path, `--${kind}`, `docs/proof/phase-1/invalid.${kind}.json`], { encoding: 'utf8' })
      assert.equal(result.status, 2)
      assert.match(result.stderr, message)
      assert.equal(result.stdout, '')
    }
    assert.equal(existsSync(path), false)
  })
})

test('a full 18,000-tick headless run stays deterministic under full spawn and wind load', () => {
  const { at, end } = replay('full-night')
  const final = at(18000)
  assert.deepEqual(end, { type: 'end', ticks: 18000, state: 'lost', score: 120 })
  assert.equal(final.shades.length, 10)
  assert.equal(final.drifters.length, 2)
  assert.equal(final.motes.length, 30)
  assert.equal(final.player.flames, 3)
  assert.equal(final.lanterns[0].fuel, 40)
  assert.equal(final.wind.active, true)
  withTemp((path) => {
    const result = runCase('full-night', path)
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.elapsedMs <= 30000)
    assert.deepEqual(readFileSync(path), readFileSync(`${dir}full-night.jsonl`))
  })
})

test('repeating the no-scenario Night 1 run preserves spawn IDs and bytes', () => {
  const { events } = replay('night1-spawn')
  assert.deepEqual(events, [
    event(300, 'shade_spawned', { id: 'S1' }),
    event(300, 'shade_spawned', { id: 'S2' }),
    event(780, 'shade_spawned', { id: 'S3' }),
  ])
  withTemp((path) => {
    const result = runCase('night1-spawn', path)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(readFileSync(path), readFileSync(`${dir}night1-spawn.jsonl`))
  })
})
