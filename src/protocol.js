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
    for (const button of ['jump', 'interact', 'pulse']) {
      if (button in frame && typeof frame[button] !== 'boolean') throw new Error(`input ${button} must be a boolean`)
    }
  }
  return value.frames
}

export function validateScenario(value, lanternCount) {
  if (!isObject(value)) throw new Error('scenario must be an object')
  for (const flag of ['random_motes', 'random_shades']) {
    if (flag in value && typeof value[flag] !== 'boolean') throw new Error(`scenario ${flag} must be a boolean`)
  }
  if ('time_left_s' in value && (!Number.isFinite(value.time_left_s) || value.time_left_s < 0)) {
    throw new Error('scenario time_left_s must be a non-negative number')
  }
  if ('player' in value) {
    if (!isObject(value.player)) throw new Error('scenario player must be an object')
    if ('pos' in value.player && !vector(value.player.pos, 3)) throw new Error('scenario player.pos must be [x,y,z]')
    for (const field of ['carried', 'flames']) {
      if (field in value.player && !isCount(value.player[field])) {
        throw new Error(`scenario player.${field} must be a non-negative integer`)
      }
    }
  }
  if ('motes' in value && (!Array.isArray(value.motes) || !value.motes.every((pos) => vector(pos, 3)))) {
    throw new Error('scenario motes must be an array of [x,y,z] positions')
  }
  if ('shades' in value) {
    if (!Array.isArray(value.shades)) throw new Error('scenario shades must be an array')
    const ids = new Set()
    for (const shade of value.shades) {
      if (!isObject(shade) || !vector(shade.pos, 3)) throw new Error('scenario shade.pos must be [x,y,z]')
      if ('id' in shade) {
        if (typeof shade.id !== 'string' || !shade.id.trim() || ids.has(shade.id)) {
          throw new Error('scenario shade IDs must be unique non-empty strings')
        }
        ids.add(shade.id)
      }
    }
  }
  if ('lanterns' in value) {
    if (!Array.isArray(value.lanterns)) throw new Error('scenario lanterns must be an array')
    const allowed = new Set(Array.from({ length: lanternCount }, (_, i) => `L${i + 1}`))
    for (const lantern of value.lanterns) {
      if (!isObject(lantern) || !allowed.delete(lantern.id)) throw new Error('scenario lantern ID is unknown or repeated')
      if ('pos' in lantern && !vector(lantern.pos, 3)) throw new Error('scenario lantern.pos must be [x,y,z]')
      if ('deposited' in lantern && !isCount(lantern.deposited)) {
        throw new Error('scenario lantern.deposited must be a non-negative integer')
      }
      if ('lit' in lantern && typeof lantern.lit !== 'boolean') throw new Error('scenario lantern.lit must be a boolean')
    }
  }
  return value
}
