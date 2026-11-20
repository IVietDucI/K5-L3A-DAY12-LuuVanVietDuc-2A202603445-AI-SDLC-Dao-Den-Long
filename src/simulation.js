import contract from '../game.contract.json' with { type: 'json' }

export const tuning = contract.tuning
export const TICK_RATE = 60
export const STEP = 1 / TICK_RATE
export const ISLAND_RADIUS = 24
export const DEFAULT_INPUT = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false }

const TAU = Math.PI * 2
const TO_RADIANS = Math.PI / 180
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])
const within = (a, b, radius) => distance(a, b) <= radius
const durationInTicks = (seconds) => Math.ceil(seconds * TICK_RATE)
const ring = (radius, angle, y = 0) => [Math.cos(angle) * radius, y, Math.sin(angle) * radius]

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function defaultMotes(lanternCount, random) {
  const positions = [[0, 0, 1.7], [0, 0, -1.7]]
  for (let i = 0; i < lanternCount; i++) {
    const angle = Math.PI / 2 + i * TAU / lanternCount
    for (const radius of [4, 7, 10, 16.8, 19, 20.8]) {
      positions.push(ring(radius + (random() - 0.5) * 0.55, angle + (random() - 0.5) * 0.1))
    }
  }
  return positions
}

function createLanterns(overrides) {
  const patches = new Map(overrides.map((lantern) => [lantern.id, lantern]))
  return Array.from({ length: tuning.lantern_count_night1 }, (_, index) => {
    const id = `L${index + 1}`
    const angle = Math.PI / 2 + index * TAU / tuning.lantern_count_night1
    const patch = patches.get(id)
    return {
      id,
      pos: patch?.pos?.slice() ?? ring(14, angle),
      deposited: patch?.deposited ?? 0,
      lit: patch?.lit ?? false,
    }
  })
}

export class Simulation {
  constructor(seed = 0, scenario = {}) {
    this.tick = 0
    this.state = 'playing'
    this.score = 0
    this.initialTime = scenario.time_left_s ?? tuning.night1_duration_s
    this.timeLeft = this.initialTime
    this.player = {
      pos: scenario.player?.pos?.slice() ?? [0, 0, 0],
      carried: scenario.player?.carried ?? 0,
      flames: scenario.player?.flames ?? tuning.flames,
      vy: 0,
      invulnerableUntil: 0,
      pulseReadyAt: 0,
    }
    this.previousInput = DEFAULT_INPUT
    this.lanterns = createLanterns(scenario.lanterns ?? [])
    this.motes = (scenario.motes ?? (scenario.random_motes === false
      ? [] : defaultMotes(this.lanterns.length, seededRandom(seed)))).map((pos) => ({ pos: pos.slice(), active: true }))

    const configuredShades = scenario.shades ?? []
    const reservedIds = new Set(configuredShades.map((shade) => shade.id))
    let nextId = 1
    this.shades = configuredShades.map(({ id, pos }) => {
      while (reservedIds.has(`S${nextId}`)) nextId++
      return { id: id ?? `S${nextId++}`, pos: pos.slice(), state: 'chasing', stunnedUntil: 0 }
    })
    const shadeRandom = seededRandom(seed ^ 0x71ac9)
    this.spawns = scenario.shades || scenario.random_shades === false ? [] :
      [6, 12, 18].map((second, index) => ({
        tick: second * TICK_RATE,
        id: `S${index + 1}`,
        pos: ring(20 + shadeRandom(), shadeRandom() * TAU, 0.85),
      }))
  }

  emit(events, name, data) {
    events.push({ type: 'event', tick: this.tick, name, data })
  }

  step(input = DEFAULT_INPUT) {
    if (this.state !== 'playing') return []
    const events = []
    this.tick++
    this.timeLeft = Math.max(0, this.initialTime - this.tick / TICK_RATE)
    const litAtStart = this.lanterns.every((lantern) => lantern.lit)
    if (litAtStart || this.player.flames === 0) {
      this.finish(events, litAtStart ? 'all_lit' : 'no_flames')
      return events
    }

    this.movePlayer(input)
    this.pickMotes(events)
    if (input.interact && !this.previousInput.interact) this.deposit(events)
    if (this.lanterns.every((lantern) => lantern.lit)) {
      this.finish(events, 'all_lit')
      return events
    }

    for (const spawn of this.spawns) {
      if (spawn.tick !== this.tick) continue
      this.shades.push({ id: spawn.id, pos: spawn.pos.slice(), state: 'chasing', stunnedUntil: 0 })
      this.emit(events, 'shade_spawned', { id: spawn.id })
    }
    if (input.pulse && !this.previousInput.pulse) this.pulse(events)
    this.updateShades(events)
    this.previousInput = input
    if (this.player.flames === 0) this.finish(events, 'no_flames')
    else if (this.timeLeft === 0) this.finish(events, 'dawn')
    return events
  }

  movePlayer(input) {
    const { pos } = this.player
    const [x, z] = input.move
    const yaw = (input.cam_yaw_deg % 360) * TO_RADIANS
    const scale = tuning.player_speed * STEP / Math.max(1, Math.hypot(x, z))
    const nextX = pos[0] + (x * Math.cos(yaw) + z * Math.sin(yaw)) * scale
    const nextZ = pos[2] + (-x * Math.sin(yaw) + z * Math.cos(yaw)) * scale
    const radius = Math.hypot(nextX, nextZ)
    const edge = radius > ISLAND_RADIUS && Math.hypot(pos[0], pos[2]) <= ISLAND_RADIUS + 1e-9
      ? ISLAND_RADIUS / radius : 1
    pos[0] = nextX * edge
    pos[2] = nextZ * edge

    if (input.jump && !this.previousInput.jump && pos[1] === 0) this.player.vy = 5.4
    pos[1] = Math.max(0, pos[1] + this.player.vy * STEP)
    this.player.vy = pos[1] > 0 ? this.player.vy - 14 * STEP : 0
  }

  pickMotes(events) {
    for (const mote of this.motes) {
      if (this.player.carried >= tuning.carry_capacity) break
      if (!mote.active || !within(mote.pos, this.player.pos, tuning.pickup_radius)) continue
      mote.active = false
      this.player.carried++
      this.score += tuning.score.per_mote
      this.emit(events, 'mote_picked', { carried: this.player.carried })
    }
  }

  nearbyUnlitLantern() {
    let target
    let closest = Infinity
    for (const lantern of this.lanterns) {
      if (lantern.lit) continue
      const gap = distance(lantern.pos, this.player.pos)
      if (gap <= tuning.interact_radius && gap < closest) {
        target = lantern
        closest = gap
      }
    }
    return target
  }

  deposit(events) {
    const target = this.nearbyUnlitLantern()
    if (!target) return
    const amount = Math.min(this.player.carried, Math.max(0, tuning.lantern_cost - target.deposited))
    if (amount > 0) {
      this.player.carried -= amount
      target.deposited += amount
      this.emit(events, 'deposit', { lantern_id: target.id, amount, deposited: target.deposited })
    }
    if (target.deposited >= tuning.lantern_cost) {
      target.lit = true
      this.score += tuning.score.per_lantern
      this.emit(events, 'lantern_lit', { lantern_id: target.id })
    }
  }

  playerInShelter() {
    return this.lanterns.some((lantern) => lantern.lit && within(this.player.pos, lantern.pos, tuning.safe_radius))
  }

  pulse(events) {
    const { player } = this
    if (player.carried < tuning.pulse_cost || this.tick < player.pulseReadyAt) return
    player.carried -= tuning.pulse_cost
    player.pulseReadyAt = this.tick + durationInTicks(tuning.pulse_cooldown_s)
    const stunnedIds = []
    for (const shade of this.shades) {
      if (!within(shade.pos, player.pos, tuning.pulse_radius)) continue
      const dx = shade.pos[0] - player.pos[0]
      const dz = shade.pos[2] - player.pos[2]
      const length = Math.hypot(dx, dz)
      shade.pos[0] += (length ? dx / length : 1) * tuning.pulse_push_m
      shade.pos[2] += (length ? dz / length : 0) * tuning.pulse_push_m
      shade.stunnedUntil = this.tick + durationInTicks(tuning.pulse_stun_s)
      shade.state = 'stunned'
      stunnedIds.push(shade.id)
    }
    this.score += stunnedIds.length * tuning.score.per_stun
    this.emit(events, 'pulse', { stunned_ids: stunnedIds })
  }

  updateShades(events) {
    const shelters = this.lanterns.filter((lantern) => lantern.lit)
    const shelterAt = (pos) => shelters.find((lantern) => within(pos, lantern.pos, tuning.safe_radius))
    const playerSafe = this.playerInShelter()
    for (const shade of this.shades) {
      if (this.tick < shade.stunnedUntil) continue
      const shelter = shelterAt(shade.pos)
      const target = shelter?.pos ?? this.player.pos
      const dx = target[0] - shade.pos[0]
      const dz = target[2] - shade.pos[2]
      const length = Math.hypot(dx, dz)
      const stride = tuning.shade_speed * STEP
      shade.state = shelter ? 'avoiding' : 'chasing'

      if (shelter) {
        shade.pos[0] += (length ? -dx / length : 1) * stride
        shade.pos[2] += (length ? -dz / length : 0) * stride
      } else if (length > 0) {
        const angle = Math.atan2(dz, dx)
        for (const turn of [0, 30, -30, 60, -60, 90, -90]) {
          const theta = angle + turn * TO_RADIANS
          const step = Math.min(stride, length)
          const next = [shade.pos[0] + Math.cos(theta) * step, shade.pos[1], shade.pos[2] + Math.sin(theta) * step]
          if (shelterAt(next)) continue
          shade.pos = next
          break
        }
      }

      if (!playerSafe && this.player.flames > 0 && this.tick >= this.player.invulnerableUntil &&
          within(shade.pos, this.player.pos, tuning.shade_hit_radius)) {
        this.player.flames--
        this.player.invulnerableUntil = this.tick + durationInTicks(tuning.invuln_s)
        this.emit(events, 'player_hit', { by: 'shade', flames: this.player.flames, dropped: 0 })
      }
    }
  }

  finish(events, reason) {
    this.state = reason === 'all_lit' ? 'won' : 'lost'
    if (this.state === 'won') {
      this.score += Math.floor(this.timeLeft) * tuning.score.per_second_left +
        this.player.flames * tuning.score.per_flame_left
    }
    this.emit(events, 'game_over', { result: this.state, reason })
  }

  snapshot() {
    const position = (pos) => pos.map((axis) => Number(axis.toFixed(3)))
    const { pos, carried, flames } = this.player
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: this.timeLeft,
      score: this.score,
      player: { pos: position(pos), flames, carried },
      lanterns: this.lanterns.map((lantern) => ({ ...lantern, pos: position(lantern.pos) })),
      shades: this.shades.map((shade) => ({ id: shade.id, pos: position(shade.pos), state: shade.state })),
      motes_active: this.motes.filter((mote) => mote.active).length,
    }
  }
}
