import { closeSync, openSync, readFileSync, writeSync } from 'node:fs'
import { DEFAULT_INPUT, Simulation, tuning } from './simulation.js'
import { validateInputs, validateScenario } from './protocol.js'

const USAGE = 'node src/headless.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]'

function parseArguments(args) {
  const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every'])
  const options = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const name = flag.slice(2)
    const value = args[index + 1]
    if (!flag.startsWith('--') || !known.has(name) || options.has(name) || !value || value.startsWith('--')) {
      throw new Error(`invalid option or missing value: ${flag}`)
    }
    options.set(name, value)
  }
  const integer = (name, min) => {
    const raw = options.get(name)
    const value = Number(raw)
    if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min) {
      throw new Error(`--${name} must be an integer${min >= 0 ? ` >= ${min}` : ''}`)
    }
    return value
  }
  const seed = integer('seed', Number.MIN_SAFE_INTEGER)
  const ticks = integer('ticks', 0)
  const every = options.has('snapshot-every') ? integer('snapshot-every', 1) : 10
  if (integer('night', 1) !== 1) throw new Error('only --night 1 is supported')
  if (!options.has('out')) throw new Error('--out is required')
  return { seed, ticks, every, out: options.get('out'), scenario: options.get('scenario'), inputs: options.get('inputs') }
}

function readJson(path, validate) {
  try {
    return validate(JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')))
  } catch (error) {
    throw new Error(`${path}: ${error.message}`)
  }
}

function run(options, scenario, frames) {
  const sim = new Simulation(options.seed, scenario)
  const fd = openSync(options.out, 'w')
  const write = (value) => writeSync(fd, JSON.stringify(value) + '\n')
  try {
    let input = DEFAULT_INPUT
    let nextFrame = 0
    write(sim.snapshot())
    while (sim.tick < options.ticks && sim.state === 'playing') {
      if (frames[nextFrame]?.tick === sim.tick) {
        input = { ...input, ...frames[nextFrame++] }
      }
      for (const event of sim.step(input)) write(event)
      if (sim.tick % options.every === 0) write(sim.snapshot())
    }
    write({ type: 'end', ticks: sim.tick, state: sim.state, score: sim.score })
  } finally {
    closeSync(fd)
  }
}

let options
let scenario
let frames
try {
  options = parseArguments(process.argv.slice(2))
  scenario = options.scenario ? readJson(options.scenario, (json) => validateScenario(json, tuning.lantern_count_night1)) : {}
  frames = options.inputs ? readJson(options.inputs, validateInputs) : []
} catch (error) {
  process.stderr.write(`${error.message}\n${USAGE}\n`)
  process.exitCode = 2
}

if (!process.exitCode) {
  try {
    run(options, scenario, frames)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
