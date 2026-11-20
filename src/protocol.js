import { DRIFTER_STATES, SHADE_STATES, tuning } from './simulation.js'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const vector = (value, size) => Array.isArray(value) && value.length === size && value.every(Number.isFinite)

export function validateInputs(value) {
  if (!isObject(value) || !Array.isArray(value.frames)) throw new Error('inputs.frames must be an array')

  let previous = -1
  for (const frame of value.frames) {
    if (!isObject(frame) || !isCount(frame.tick) || frame.tick <= previous) {
      throw new Error('input frame ticks must be non-negative integers in strictly increasing order')
    }
    previous = frame.tick
    if ('move' in frame && (!vector(frame.move, 2) || frame.move.some((axis) => Math.abs(axis) > 1))) {
      throw new Error('input move must be [x,z] with both axes in [-1,1]')
    }
    if ('cam_yaw_deg' in frame && !Number.isFinite(frame.cam_yaw_deg)) {
      throw new Error('input cam_yaw_deg must be a finite number')
    }
    for (const button of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      if (button in frame && typeof frame[button] !== 'boolean') throw new Error(`input ${button} must be a boolean`)
    }
  }
  return value.frames
}

function checkEntities(entities, name, check) {
  if (!Array.isArray(entities)) throw new Error(`scenario ${name} must be an array`)
  const ids = new Set()
  for (const entity of entities) {
    if (!isObject(entity)) throw new Error(`scenario ${name} entries must be objects`)
    if ('id' in entity) {
      if (typeof entity.id !== 'string' || !entity.id.trim() || ids.has(entity.id)) {
        throw new Error(`scenario ${name} IDs must be unique non-empty strings`)
      }
      ids.add(entity.id)
    }
    check(entity)
  }
}

function checkCount(entity, field) {
  if (field in entity && !isCount(entity[field])) throw new Error(`scenario ${field} must be a non-negative integer`)
}

function checkActor(actor, type, states) {
  if (!vector(actor.pos, 3)) throw new Error(`scenario ${type}.pos must be [x,y,z]`)
  if ('state' in actor && !states.includes(actor.state)) throw new Error(`scenario ${type}.state is unknown`)
  checkCount(actor, 'state_ticks_left')
}

export function validateScenario(value, island) {
  if (!isObject(value)) throw new Error('scenario must be an object')
  for (const flag of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (flag in value && typeof value[flag] !== 'boolean') throw new Error(`scenario ${flag} must be a boolean`)
  }
  if ('time_left_s' in value && (!Number.isFinite(value.time_left_s) || value.time_left_s < 0)) {
    throw new Error('scenario time_left_s must be a non-negative number')
  }
  if ('player' in value) {
    if (!isObject(value.player)) throw new Error('scenario player must be an object')
    if ('pos' in value.player && !vector(value.player.pos, 3)) throw new Error('scenario player.pos must be [x,y,z]')
    for (const field of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      checkCount(value.player, field)
    }
  }
  if ('motes' in value) {
    if (!Array.isArray(value.motes)) throw new Error('scenario motes must be an array')
    checkEntities(value.motes.map((mote) => Array.isArray(mote) ? { pos: mote } : mote), 'motes', (mote) => {
      if (!vector(mote.pos, 3)) throw new Error('scenario mote.pos must be [x,y,z]')
      if ('kind' in mote && !['random', 'dropped'].includes(mote.kind)) throw new Error('scenario mote.kind is unknown')
      checkCount(mote, 'ttl_ticks')
    })
  }
  const lanternIds = island.lanterns.map((_, i) => `L${i + 1}`)
  if ('shades' in value) {
    checkEntities(value.shades, 'shades', (shade) => {
      checkActor(shade, 'shade', SHADE_STATES)
      if ('target_lantern_id' in shade && !lanternIds.includes(shade.target_lantern_id)) {
        throw new Error('scenario shade.target_lantern_id is unknown')
      }
    })
  }
  if ('drifters' in value) {
    checkEntities(value.drifters, 'drifters', (drifter) => {
      checkActor(drifter, 'drifter', DRIFTER_STATES)
      checkCount(drifter, 'stolen')
    })
  }
  if ('charms' in value) {
    checkEntities(value.charms, 'charms', (charm) => {
      if ('pos' in charm && !vector(charm.pos, 3)) throw new Error('scenario charm.pos must be [x,y,z]')
      if ('available' in charm && typeof charm.available !== 'boolean') throw new Error('scenario charm.available must be a boolean')
      checkCount(charm, 'respawn_ticks')
    })
    if (value.charms.some((charm, index) => !charm.pos && !island.charms[index])) {
      throw new Error('scenario charm.pos is required when there is no default position')
    }
  }
  if ('lanterns' in value) {
    if (!Array.isArray(value.lanterns)) throw new Error('scenario lanterns must be an array')
    const allowed = new Set(lanternIds)
    for (const lantern of value.lanterns) {
      if (!isObject(lantern) || !allowed.delete(lantern.id)) throw new Error('scenario lantern ID is unknown or repeated')
      if ('pos' in lantern && !vector(lantern.pos, 3)) throw new Error('scenario lantern.pos must be [x,y,z]')
      if ('deposited' in lantern && !isCount(lantern.deposited)) {
        throw new Error('scenario lantern.deposited must be a non-negative integer')
      }
      if ('lit' in lantern && typeof lantern.lit !== 'boolean') throw new Error('scenario lantern.lit must be a boolean')
      if ('ever_lit' in lantern && typeof lantern.ever_lit !== 'boolean') throw new Error('scenario lantern.ever_lit must be a boolean')
      if ('fuel' in lantern && (!Number.isFinite(lantern.fuel) || lantern.fuel < 0 || lantern.fuel > tuning.fuel_max)) {
        throw new Error(`scenario lantern.fuel must be a number in [0,${tuning.fuel_max}]`)
      }
    }
  }
  return value
}
