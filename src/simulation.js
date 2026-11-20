import contract from '../game.contract.json' with { type: 'json' }
import { islands, surfacesAt } from './islands.js'

export const tuning = contract.tuning
export const TICK_RATE = 60
export const STEP = 1 / TICK_RATE
export const DEFAULT_INPUT = {
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
}
export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']
export const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed']

const EPS = 1e-9
const RAD = Math.PI / 180
const flatDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])
const within = (a, b, radius) => flatDistance(a, b) <= radius + EPS
const secondsToTicks = (seconds) => Math.round(seconds * TICK_RATE)
const countdown = (ticks) => Math.max(0, ticks - 1)
const offset = ([x, y, z], [dx, dz], distance) => [x + dx * distance, y, z + dz * distance]
const heading = (angle) => [Math.cos(angle), Math.sin(angle)]
const roundPos = (pos) => pos.map((axis) => Number(axis.toFixed(3)))
const MAX_FUEL = tuning.fuel_max * TICK_RATE
const LOW_FUEL = tuning.low_fuel_threshold * TICK_RATE
const FUEL_PER_MOTE = tuning.fuel_per_mote * TICK_RATE
export const fuelOf = (lantern) => lantern.fuelUnits / TICK_RATE
export const isWeak = (lantern) => lantern.lit && lantern.fuelUnits < LOW_FUEL
const hasShelter = (lantern) => lantern.lit && lantern.fuelUnits >= LOW_FUEL
const byId = (a, b) => {
  const left = a.id.match(/^(.*?)(\d+)$/)
  const right = b.id.match(/^(.*?)(\d+)$/)
  if (left && right && left[1] === right[1]) return Number(left[2]) - Number(right[2])
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1
}
const nextId = (prefix, entities) => {
  const used = new Set(entities.map(({ id }) => id))
  let index = 1
  return () => {
    while (used.has(`${prefix}${index}`)) index++
    return `${prefix}${index++}`
  }
}

function direction(from, to) {
  const distance = flatDistance(from, to)
  return distance > EPS ? [(to[0] - from[0]) / distance, (to[2] - from[2]) / distance] : [1, 0]
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const take = (items, random) => items.splice(Math.floor(random() * items.length), 1)[0]

export class Simulation {
  constructor(seed = 0, scenario = {}, night = 1) {
    this.tick = 0
    this.simTick = 0
    this.night = night
    this.island = islands[night]
    this.state = 'playing'
    this.score = 0
    this.initialTime = scenario.time_left_s ?? tuning[`night${night}_duration_s`]
    this.timeLeft = this.initialTime
    const initial = scenario.player ?? {}
    const pos = (initial.pos ?? this.island.spawn).slice()
    this.player = {
      pos, vel: [0, 0, 0], vy: 0,
      grounded: surfacesAt(this.island, pos[0], pos[2]).some((level) => Math.abs(level.y - pos[1]) <= EPS),
      facing: this.island.facing.slice(), launch: null, pad: null, dash: null, respawning: 0,
      carried: initial.carried ?? 0, flames: initial.flames ?? tuning.flames,
      successfulLights: initial.successful_lights ?? 0,
      invuln: initial.invuln_ticks ?? 0, dashCd: initial.dash_cd_ticks ?? 0,
      pulseCd: initial.pulse_cd_ticks ?? 0, charm: initial.charm_ticks ?? 0,
    }
    this.previousInput = DEFAULT_INPUT
    this.random = {
      motes: seededRandom(seed), shades: seededRandom(seed ^ 0x71ac9),
      drifters: seededRandom(seed ^ 0x5219), wind: seededRandom(seed ^ 0x84c12),
      drops: seededRandom(seed ^ 0x2a1f8),
    }
    this.spawnMotes = scenario.motes === undefined && scenario.random_motes !== false
    this.spawnShades = scenario.shades === undefined && scenario.random_shades !== false
    this.spawnDrifters = night > 1 && scenario.drifters === undefined && scenario.random_drifters !== false
    this.windEnabled = night === 3 && scenario.wind_enabled !== false
    this.wind = { active: false, warning: false, dir_deg: 0 }

    const overrides = new Map((scenario.lanterns ?? []).map((lantern) => [lantern.id, lantern]))
    this.lanterns = this.island.lanterns.map((position, i) => {
      const id = `L${i + 1}`
      const patch = overrides.get(id)
      const lit = patch?.lit ?? false
      return {
        id, pos: (patch?.pos ?? position).slice(), deposited: patch?.deposited ?? 0, lit,
        fuelUnits: lit ? Math.round((patch?.fuel ?? tuning.fuel_max) * TICK_RATE) : 0,
        ever_lit: lit || (patch?.ever_lit ?? false), relit_count: 0,
      }
    })
    this.requiredLit = Math.ceil(tuning.win_ratio * this.lanterns.length)
    this.shelters = this.lanterns.filter(hasShelter)
    this.nextMoteId = nextId('M', scenario.motes ?? [])
    this.nextShadeId = nextId('S', scenario.shades ?? [])
    this.nextDrifterId = nextId('D', scenario.drifters ?? [])
    this.nextCharmId = nextId('C', scenario.charms ?? [])
    this.motes = (scenario.motes ?? []).map((mote) => {
      const config = Array.isArray(mote) ? { pos: mote } : mote
      const kind = config.kind ?? 'random'
      return {
        id: config.id ?? this.nextMoteId(), pos: config.pos.slice(), kind,
        ttl: kind === 'dropped' ? config.ttl_ticks ?? tuning.dropped_mote_ttl_ticks : null,
      }
    })
    if (this.spawnMotes) {
      const spots = this.island.moteSpots.slice()
      while (this.motes.length < tuning.mote_initial_count) this.addMote(take(spots, this.random.motes))
    }
    this.shades = (scenario.shades ?? []).map((shade) => this.makeShade(shade))
    this.drifters = (scenario.drifters ?? []).map((drifter) => this.makeDrifter(drifter))
    const charms = scenario.charms ?? this.island.charms.map((position) => ({ pos: position }))
    this.charms = charms.map((charm, index) => ({
      id: charm.id ?? this.nextCharmId(), pos: (charm.pos ?? this.island.charms[index]).slice(),
      respawn: charm.available === true ? 0 : charm.respawn_ticks ?? (charm.available === false ? tuning.charm_respawn_ticks : 0),
    }))
  }

  get ended() {
    return this.state === 'won' || this.state === 'lost'
  }

  get capacity() {
    return Math.min(tuning.capacity_max, tuning.carry_capacity + tuning.capacity_per_light * this.player.successfulLights)
  }

  startEvent() {
    return { type: 'event', tick: 0, name: 'night_start', data: { night: this.night } }
  }

  emit(events, name, data = {}) {
    events.push({ type: 'event', tick: this.tick, name, data })
  }

  step(input = DEFAULT_INPUT) {
    if (this.ended) return []
    const events = []
    this.tick++
    const pressed = (key) => input[key] && !this.previousInput[key]
    const edges = { jump: pressed('jump'), dash: pressed('dash'), interact: pressed('interact'), pulse: pressed('pulse') }
    const pause = pressed('pause')
    this.previousInput = { ...input }
    if (pause) {
      this.state = this.state === 'paused' ? 'playing' : 'paused'
      this.emit(events, this.state === 'paused' ? 'paused' : 'resumed')
    }
    if (this.state === 'paused') return events

    this.simTick++
    this.player.jumped = false
    this.advanceTimers()
    this.advanceFuel(events)
    this.movePlayer(input, edges, events)
    if (this.player.flames > 0 && this.player.respawning === 0) {
      this.pickItems(events)
      if (edges.interact) this.deposit(events)
    }
    this.updateShelters()
    if (edges.pulse && this.player.flames > 0 && this.player.respawning === 0) this.pulse(events)
    this.moveShades()
    this.moveDrifters()
    this.contacts(events)
    this.spawn(events)
    if (this.player.flames === 0) this.finish(events, 'no_flames')
    else if (this.timeLeft === 0) {
      const lit = this.lanterns.filter((lantern) => lantern.lit)
      this.finish(events, lit.length >= this.requiredLit ? 'dawn_survived' : 'dawn', lit)
    }
    return events
  }

  advanceTimers() {
    this.timeLeft = Math.max(0, this.initialTime - this.simTick / TICK_RATE)
    const p = this.player
    p.invuln = countdown(p.invuln)
    p.dashCd = countdown(p.dashCd)
    p.pulseCd = countdown(p.pulseCd)
    p.charm = countdown(p.charm)
    for (const shade of this.shades) {
      shade.timer = countdown(shade.timer)
      if (shade.state === 'spawning' && shade.timer === 0) shade.state = 'wander'
    }
    for (const drifter of this.drifters) {
      drifter.timer = countdown(drifter.timer)
      if (drifter.state === 'flee' && drifter.timer === 0) {
        drifter.state = 'removed'
        drifter.stolen = 0
      }
    }
    this.drifters = this.drifters.filter((drifter) => drifter.state !== 'removed')
    for (const mote of this.motes) if (mote.ttl !== null) mote.ttl = countdown(mote.ttl)
    this.motes = this.motes.filter((mote) => mote.ttl !== 0)
    for (const charm of this.charms) charm.respawn = countdown(charm.respawn)
    if (this.windEnabled) {
      const cycle = this.simTick % 1800
      this.wind.warning = cycle >= 1680
      this.wind.active = this.simTick >= 1800 && cycle < 300
      if (cycle === 1680) this.wind.dir_deg = this.random.wind() * 360
    }
  }

  activeDrain(shade) {
    return shade.target && isWeak(shade.target) && within(shade.pos, shade.target.pos, tuning.drain_radius)
  }

  advanceFuel(events) {
    // Determine participants before any deduction so multiple drains share the same resulting fuel.
    const draining = this.shades.filter((shade) => shade.state === 'drain' && this.activeDrain(shade))
    for (const lantern of this.lanterns) {
      if (lantern.lit) lantern.fuelUnits -= tuning.fuel_decay_per_s
    }
    for (const shade of draining) {
      shade.target.fuelUnits -= tuning.drain_per_s
      shade.drainTicks++
    }
    for (const shade of draining) {
      if (shade.drainTicks % TICK_RATE === 0) {
        this.emit(events, 'fuel_drain', { lantern_id: shade.target.id, shade_id: shade.id, fuel: Math.max(0, fuelOf(shade.target)) })
      }
    }
    for (const lantern of this.lanterns) {
      if (!lantern.lit || lantern.fuelUnits > 0) continue
      lantern.fuelUnits = 0
      lantern.lit = false
      lantern.deposited = 0
      lantern.ever_lit = true
      this.emit(events, 'lantern_out', { lantern_id: lantern.id })
    }
  }

  movePlayer(input, edges, events) {
    const p = this.player
    if (p.flames === 0) return
    if (p.respawning > 0) {
      p.respawning--
      if (p.respawning === 0) {
        p.pos = this.island.spawn.slice()
        p.facing = this.island.facing.slice()
        p.grounded = true
        p.invuln = secondsToTicks(tuning.invuln_s)
      }
      return
    }

    const yaw = (input.cam_yaw_deg % 360) * RAD
    const [x, z] = input.move
    const length = Math.hypot(x, z)
    const move = [(x * Math.cos(yaw) + z * Math.sin(yaw)) / Math.max(1, length),
      (-x * Math.sin(yaw) + z * Math.cos(yaw)) / Math.max(1, length)]
    if (length > 0) {
      const magnitude = Math.hypot(...move)
      p.facing = move.map((component) => component / magnitude)
    }
    if (edges.dash && !p.dash && (p.dashCd === 0 || p.charm > 0)) {
      p.dash = { dir: p.facing.slice(), ticks: secondsToTicks(tuning.dash_duration_s) }
      p.dashCd = p.charm > 0 ? 0 : secondsToTicks(tuning.dash_cooldown_s)
      this.emit(events, 'dash')
    }
    if (edges.jump && p.grounded) {
      p.grounded = false
      p.vy = tuning.jump_speed
      p.jumped = true
    }

    const [oldX, oldY, oldZ] = p.pos
    const speed = p.charm > 0 ? tuning.charm_speed : tuning.player_speed
    const horizontal = p.dash ? p.dash.dir.map((axis) => axis * tuning.dash_speed) :
      p.launch ?? move.map((axis) => axis * speed)
    if (this.wind.active) {
      const breeze = heading(this.wind.dir_deg * RAD)
      horizontal[0] += 2 * breeze[0]
      horizontal[1] += 2 * breeze[1]
    }
    let [nextX, , nextZ] = offset(p.pos, horizontal, STEP)
    if (this.towerBlocks([nextX, oldY, nextZ]) || this.wallBlocks(p.pos, [nextX, oldY, nextZ], p.grounded)) {
      nextX = oldX
      nextZ = oldZ
    }
    const levels = surfacesAt(this.island, nextX, nextZ)
    const oldSlope = surfacesAt(this.island, oldX, oldZ).find((level) => level.slope && Math.abs(level.y - oldY) <= EPS)
    const stride = Math.hypot(nextX - oldX, nextZ - oldZ)
    const stable = p.grounded && levels.filter((level) => Math.abs(level.y - oldY) <= EPS ||
      ((level.slope || oldSlope) && Math.abs(level.y - oldY) <= stride / 2 + EPS))
      .sort((a, b) => b.y - a.y)[0]

    let nextY = stable ? stable.y : oldY
    p.grounded = Boolean(stable)
    if (!stable && !p.dash) {
      nextY += p.vy * STEP - tuning.gravity * STEP * STEP / 2
      p.vy -= tuning.gravity * STEP
      if (p.vy <= 0) {
        const landing = levels.filter((level) => level.y <= oldY + EPS && level.y >= nextY - EPS)
          .sort((a, b) => b.y - a.y)[0]
        if (landing) {
          nextY = landing.y
          p.vy = 0
          p.grounded = true
          p.launch = null
        }
      }
    }
    p.pos = [nextX, nextY, nextZ]
    p.vel = [(nextX - oldX) / STEP, p.grounded || p.dash ? 0 : p.vy, (nextZ - oldZ) / STEP]
    if (p.dash && --p.dash.ticks === 0) p.dash = null

    const pad = this.island.pads.find((item) => within(item.pos, p.pos, 1) && Math.abs(item.pos[1] - p.pos[1]) <= EPS)
    if (p.grounded && pad && p.pad !== pad) {
      p.grounded = false
      p.vy = pad.vertical
      p.launch = direction(p.pos, [pad.target[0], 0, pad.target[1]]).map((axis) => axis * pad.speed)
      p.vel = [p.launch[0], p.vy, p.launch[1]]
      p.jumped = true
    }
    p.pad = pad
    if (nextY < tuning.fall_below_y) this.fall(events)
  }

  towerBlocks(pos) {
    const tower = this.island.tower
    return tower && pos[1] >= tower.base && pos[1] < tower.base + tower.height &&
      Math.hypot(pos[0], pos[2]) < tower.radius
  }

  wallBlocks(from, to, followRamp = false) {
    if (!this.island.ring) return false
    const previous = surfacesAt(this.island, from[0], from[2])
    const next = surfacesAt(this.island, to[0], to[2])
    const step = flatDistance(from, to) / 2 + EPS
    return next.some((level) => !level.slope && level.y > from[1] + EPS &&
      !previous.some((old) => old.y === level.y) &&
      !(followRamp && level.y - from[1] <= step && previous.some((old) => old.slope && Math.abs(old.y - from[1]) <= EPS)))
  }

  fall(events) {
    const p = this.player
    const lost = p.carried
    p.carried = 0
    p.flames--
    p.respawning = p.flames > 0 ? tuning.respawn_ticks : 0
    p.vel = [0, 0, 0]
    p.vy = 0
    p.dash = null
    p.launch = null
    p.pad = null
    this.emit(events, 'player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost })
  }

  pickItems(events) {
    const p = this.player
    const capacity = this.capacity
    const reachable = (pos) => within(pos, p.pos, tuning.pickup_radius) &&
      Math.abs(pos[1] - p.pos[1]) <= tuning.pickup_max_height + EPS
    this.motes = this.motes.filter((mote) => {
      if (p.carried >= capacity || !reachable(mote.pos)) return true
      p.carried++
      this.emit(events, 'mote_picked', { carried: p.carried })
      return false
    })
    for (const charm of this.charms) {
      if (charm.respawn !== 0 || !reachable(charm.pos)) continue
      p.charm = tuning.charm_duration_ticks
      charm.respawn = tuning.charm_respawn_ticks
      this.emit(events, 'charm_picked', { charm_id: charm.id, charm_ticks: p.charm })
    }
  }

  nearestLantern(pos, eligible, radius = Infinity) {
    let best
    let closest = radius
    for (const lantern of this.lanterns) {
      if (!eligible(lantern)) continue
      const gap = flatDistance(lantern.pos, pos)
      if (gap > closest + EPS || (best && Math.abs(gap - closest) <= EPS)) continue
      best = lantern
      closest = gap
    }
    return best
  }

  nearestUnlitLantern() {
    return this.nearestLantern(this.player.pos, (lantern) => !lantern.lit)
  }

  nearbyLantern() {
    return this.nearestLantern(this.player.pos, (lantern) => !lantern.lit || lantern.fuelUnits < MAX_FUEL, tuning.interact_radius)
  }

  deposit(events) {
    const target = this.nearbyLantern()
    if (!target) return
    const p = this.player
    const relight = target.ever_lit
    const cost = relight ? tuning.relight_cost : tuning.lantern_cost
    const missing = target.lit ? Math.ceil((MAX_FUEL - target.fuelUnits) / FUEL_PER_MOTE) : Math.max(0, cost - target.deposited)
    const amount = Math.min(p.carried, missing)
    if (amount === 0) return
    p.carried -= amount
    this.score += amount * tuning.score.per_mote
    if (target.lit) {
      target.fuelUnits = Math.min(MAX_FUEL, target.fuelUnits + amount * FUEL_PER_MOTE)
      this.emit(events, 'refuel', { lantern_id: target.id, amount, fuel: fuelOf(target) })
      return
    }
    target.deposited += amount
    this.emit(events, 'deposit', { lantern_id: target.id, amount, deposited: target.deposited })
    if (target.deposited >= cost) {
      target.lit = true
      target.ever_lit = true
      target.fuelUnits = MAX_FUEL
      target.relit_count += Number(relight)
      p.successfulLights++
      this.score += relight ? tuning.score.per_relight : tuning.score.per_lantern
      this.emit(events, 'lantern_lit', { lantern_id: target.id, relight })
    }
  }

  playerInShelter() {
    return this.shelters.some((lantern) => within(lantern.pos, this.player.pos, tuning.safe_radius))
  }

  updateShelters() {
    const previousShelters = this.shelters
    this.shelters = this.lanterns.filter(hasShelter)
    for (const shade of this.shades) {
      shade.evicted = false
      shade.releasedDrain = shade.state === 'drain' && !this.activeDrain(shade)
      if (shade.releasedDrain) this.stopDrain(shade, 'wander')
      if (shade.state === 'spawning') continue
      const inside = (lantern) => flatDistance(shade.pos, lantern.pos) < tuning.safe_radius - EPS
      const eviction = shade.eviction
      const continuing = eviction?.persist && eviction.zone.lit && inside(eviction.zone) ? eviction.zone : null
      const zone = continuing ?? this.shelters.find(inside)
      if (!zone) {
        shade.eviction = null
        continue
      }
      if (shade.eviction?.zone !== zone) {
        shade.eviction = { zone, ticks: tuning.safe_evict_ticks, persist: !previousShelters.includes(zone) }
      }
      const push = (tuning.safe_radius - flatDistance(shade.pos, zone.pos)) / shade.eviction.ticks
      shade.pos = offset(shade.pos, direction(zone.pos, shade.pos), push)
      shade.evicted = true
      shade.eviction.ticks--
    }
  }

  pulse(events) {
    const p = this.player
    if (p.carried < tuning.pulse_cost || p.pulseCd > 0) return
    p.carried -= tuning.pulse_cost
    p.pulseCd = secondsToTicks(tuning.pulse_cooldown_s)
    const centerY = p.pos[1] + tuning.pulse_center_y
    const inPulse = ({ pos }) => Math.hypot(flatDistance(p.pos, pos), pos[1] - centerY) <= tuning.pulse_radius + EPS
    const stunnedIds = []
    for (const shade of this.shades) {
      if (shade.state === 'spawning' || !inPulse(shade)) continue
      this.score += shade.state === 'drain' ? tuning.score.per_drain_stun : tuning.score.per_stun
      this.stopDrain(shade, 'stunned')
      shade.timer = secondsToTicks(tuning.pulse_stun_s)
      shade.push = { dir: direction(p.pos, shade.pos), ticks: tuning.pulse_push_ticks }
      stunnedIds.push(shade.id)
    }
    this.emit(events, 'pulse', { stunned_ids: stunnedIds })
    for (const drifter of this.drifters) {
      if (!inPulse(drifter)) continue
      if (drifter.state === 'chase') this.flee(drifter)
      else if (drifter.state === 'flee' && drifter.stolen > 0) {
        const amount = drifter.stolen
        for (let i = 0; i < amount; i++) this.addMote(drifter.pos, 'dropped')
        drifter.stolen = 0
        drifter.timer = tuning.drifter_after_drop_ticks
        this.emit(events, 'drifter_drop', { drifter_id: drifter.id, amount })
      }
    }
  }

  makeShade(config) {
    const state = config.state ?? 'wander'
    const durations = { spawning: 1, stunned: secondsToTicks(tuning.pulse_stun_s), recoil: tuning.shade_recoil_ticks }
    return {
      id: config.id ?? this.nextShadeId(), pos: config.pos.slice(), origin: config.pos.slice(), state,
      timer: config.state_ticks_left ?? durations[state] ?? 0,
      push: null, recoil: null, eviction: null, evicted: false,
      target: this.lanterns.find(({ id }) => id === config.target_lantern_id), drainTicks: 0,
    }
  }

  stopDrain(shade, state) {
    shade.state = state
    shade.target = null
    shade.drainTicks = 0
  }

  shadeStep(shade, dir, distance) {
    const original = shade.pos
    const next = offset(original, dir, distance)
    const blocked = (pos) => this.towerBlocks(pos) || this.wallBlocks(original, pos)
    if (blocked(next)) {
      let open = 0
      let wall = distance
      for (let i = 0; i < 12; i++) {
        const probe = (open + wall) / 2
        if (blocked(offset(original, dir, probe))) wall = probe
        else open = probe
      }
      shade.pos = offset(original, dir, open)
      return false
    }
    for (const zone of this.shelters) {
      const gap = flatDistance(shade.pos, zone.pos)
      const nextGap = flatDistance(next, zone.pos)
      if (nextGap >= tuning.safe_radius - EPS || nextGap > gap) continue
      if (gap > tuning.safe_radius + EPS) {
        const [dx, dz] = direction(zone.pos, next)
        shade.pos = offset([zone.pos[0], shade.pos[1], zone.pos[2]], [dx, dz], tuning.safe_radius)
      }
      return false
    }
    shade.pos = next
    return true
  }

  moveShades() {
    const p = this.player
    const speed = this.night === 3 ? tuning.shade_speed_night3 : tuning.shade_speed
    for (const shade of this.shades) {
      if (shade.state === 'spawning') continue
      if (shade.state === 'stunned') {
        if (shade.timer === 0) shade.state = 'wander'
        else if (shade.push?.ticks > 0) {
          const moved = this.shadeStep(shade, shade.push.dir, tuning.pulse_push_m / tuning.pulse_push_ticks)
          shade.push.ticks = moved ? shade.push.ticks - 1 : 0
        }
        continue
      }
      if (shade.evicted || shade.releasedDrain) continue
      if (shade.state === 'recoil' && shade.timer > 0) {
        shade.recoil ??= direction(p.pos, shade.pos)
        this.shadeStep(shade, shade.recoil, tuning.shade_recoil_m / tuning.shade_recoil_ticks)
        continue
      }
      const distance = flatDistance(shade.pos, p.pos)
      if (shade.state === 'drain') {
        if (p.respawning > 0 || distance > tuning.drain_interrupt_radius + EPS) continue
        this.stopDrain(shade, 'chase')
      }
      const threshold = shade.state === 'chase' ? tuning.shade_lose_radius : tuning.shade_detect_radius
      shade.state = p.respawning === 0 && distance <= threshold + EPS ? 'chase' : 'wander'
      if (shade.state === 'chase') {
        if (distance > EPS) this.shadeStep(shade, direction(shade.pos, p.pos), Math.min(distance, speed * STEP))
      } else {
        const weak = this.nearestLantern(shade.pos, isWeak)
        const lantern = weak ?? this.nearestLantern(shade.pos, (target) => !target.lit)
        const angle = this.simTick / 120 + shade.origin[0] / 9
        const target = lantern?.pos ?? offset(shade.origin, heading(angle), 4)
        const gap = flatDistance(shade.pos, target)
        const remaining = weak ? Math.max(0, gap - tuning.drain_radius) : gap
        if (remaining > EPS) this.shadeStep(shade, direction(shade.pos, target), Math.min(remaining, speed * STEP))
        if (weak && within(shade.pos, weak.pos, tuning.drain_radius)) {
          shade.state = 'drain'
          shade.target = weak
          shade.drainTicks = 0
        }
      }
    }
  }

  makeDrifter(config) {
    return {
      id: config.id ?? this.nextDrifterId(), pos: config.pos.slice(), origin: config.pos.slice(),
      state: config.state ?? 'idle', stolen: config.stolen ?? 0,
      timer: config.state_ticks_left ?? (config.state === 'flee' ? tuning.drifter_flee_ticks : 0),
    }
  }

  flee(drifter) {
    drifter.state = 'flee'
    drifter.timer = tuning.drifter_flee_ticks
  }

  moveDrifters() {
    const p = this.player
    for (const drifter of this.drifters) {
      if (drifter.state === 'flee') {
        drifter.pos = offset(drifter.pos, direction(p.pos, drifter.pos), tuning.drifter_speed * STEP)
      } else if (p.respawning === 0 && p.carried >= tuning.drifter_chase_carry &&
          within(drifter.pos, p.pos, tuning.drifter_chase_radius)) {
        drifter.state = 'chase'
        const gap = flatDistance(drifter.pos, p.pos)
        if (gap > EPS) drifter.pos = offset(drifter.pos, direction(drifter.pos, p.pos), Math.min(gap, tuning.drifter_speed * STEP))
      } else {
        drifter.state = 'idle'
        const target = offset(drifter.origin, heading(this.simTick / 180 + drifter.origin[0] / 11), 5)
        drifter.pos = offset(drifter.pos, direction(drifter.pos, target),
          Math.min(flatDistance(drifter.pos, target), tuning.drifter_idle_speed * STEP))
      }
    }
  }

  contacts(events) {
    const p = this.player
    if (p.flames === 0 || p.respawning > 0) return
    for (const drifter of this.drifters.slice().sort(byId)) {
      if (drifter.state !== 'chase' || !within(drifter.pos, p.pos, tuning.drifter_hit_radius) || p.carried === 0) continue
      drifter.stolen = Math.min(p.carried, tuning.drifter_steal)
      p.carried -= drifter.stolen
      this.flee(drifter)
      this.emit(events, 'drifter_steal', { drifter_id: drifter.id, amount: drifter.stolen, carried: p.carried })
    }
    if (p.invuln > 0 || this.playerInShelter()) return
    for (const shade of this.shades.slice().sort(byId)) {
      if (shade.state !== 'chase' || shade.evicted || !within(shade.pos, p.pos, tuning.shade_hit_radius) ||
        Math.abs(shade.pos[1] - p.pos[1]) > tuning.shade_hit_max_height + EPS) continue
      p.flames--
      p.invuln = secondsToTicks(tuning.invuln_s)
      const dropped = Math.floor(p.carried * tuning.hit_drop_ratio)
      p.carried -= dropped
      for (let i = 0; i < dropped; i++) {
        const distance = tuning.hit_drop_min_m + this.random.drops() * (tuning.hit_drop_max_m - tuning.hit_drop_min_m)
        const pos = offset(p.pos, heading(this.random.drops() * Math.PI * 2), distance)
        const ground = surfacesAt(this.island, pos[0], pos[2]).filter((level) => level.y <= p.pos[1] + EPS)
        pos[1] = Math.max(0, ...ground.map((level) => level.y))
        this.addMote(pos, 'dropped')
      }
      shade.state = 'recoil'
      // Contact is after movement, so the first of the 60 retreat steps is next tick.
      shade.timer = tuning.shade_recoil_ticks + 1
      shade.recoil = direction(p.pos, shade.pos)
      this.emit(events, 'player_hit', { by: 'shade', flames: p.flames, dropped })
      break
    }
  }

  addMote(pos, kind = 'random') {
    this.motes.push({ id: this.nextMoteId(), pos: pos.slice(), kind, ttl: kind === 'dropped' ? tuning.dropped_mote_ttl_ticks : null })
  }

  spawn(events) {
    const tick = this.simTick
    if (this.spawnMotes && tick % tuning.mote_spawn_ticks === 0 && this.motes.length < tuning.mote_limit) {
      const free = this.island.moteSpots.filter((spot) => !this.motes.some((mote) =>
        mote.kind === 'random' && within(spot, mote.pos, EPS) && spot[1] === mote.pos[1]))
      if (free.length > 0) this.addMote(take(free, this.random.motes))
    }
    if (this.spawnShades && tick >= 300 && (tick - 300) % this.island.shadeInterval === 0) {
      const free = this.island.shadeSpots.filter((spot) =>
        flatDistance(spot, this.player.pos) >= (this.island.shadeMinPlayerGap ?? 0) - EPS &&
        !this.shades.some((shade) => within(spot, shade.pos, 1)))
      const count = Math.min(tick === 300 ? 2 : 1, this.island.shadeLimit - this.shades.length, free.length)
      for (let i = 0; i < count; i++) {
        const shade = this.makeShade({ pos: take(free, this.random.shades), state: 'spawning' })
        this.shades.push(shade)
        this.emit(events, 'shade_spawned', { id: shade.id })
      }
    }
    if (this.spawnDrifters && tick % tuning.drifter_spawn_ticks === 0 && this.drifters.length < 2) {
      const spots = this.island.shadeSpots.slice()
      this.drifters.push(this.makeDrifter({ pos: take(spots, this.random.drifters) }))
    }
  }

  finish(events, reason, lit = []) {
    this.state = reason === 'dawn_survived' ? 'won' : 'lost'
    if (this.state === 'won') {
      this.score += lit.reduce((score, lantern) => score + tuning.score.per_lit_at_dawn + Math.floor(fuelOf(lantern)), 0)
      this.score += this.player.flames * tuning.score.per_flame_left
    }
    this.emit(events, 'game_over', { result: this.state, reason })
  }

  snapshot() {
    const p = this.player
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.simTick, night: this.night, state: this.state,
      time_left_s: this.timeLeft, score: this.score, wind: { active: this.wind.active, dir_deg: this.wind.dir_deg },
      player: {
        pos: roundPos(p.pos), vel: roundPos(p.vel), flames: p.flames, carried: p.carried, capacity: this.capacity, grounded: p.grounded,
        invuln: p.invuln > 0, dash_cd_s: p.dashCd * STEP, pulse_cd_s: p.pulseCd * STEP, charm_s: p.charm * STEP,
      },
      lanterns: this.lanterns.map(({ fuelUnits, ...lantern }) => ({
        ...lantern, pos: roundPos(lantern.pos), fuel: Math.round(fuelUnits / (TICK_RATE / 10)) / 10,
      })),
      shades: this.shades.map(({ id, pos, state }) => ({ id, pos: roundPos(pos), state })),
      motes_active: this.motes.length,
      motes: this.motes.map(({ id, pos, kind, ttl }) => ({ id, pos: roundPos(pos), kind, ttl_s: ttl === null ? null : ttl * STEP })),
      drifters: this.drifters.map(({ id, pos, state, stolen }) => ({ id, pos: roundPos(pos), state, stolen })),
      charms: this.charms.map(({ id, respawn }) => ({ id, available: respawn === 0, respawn_s: respawn * STEP })),
    }
  }
}
