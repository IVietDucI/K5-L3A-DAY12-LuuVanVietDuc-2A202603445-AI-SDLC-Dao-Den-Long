import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { DEFAULT_INPUT, Simulation, seededRandom, TICK_RATE, tuning } from '../src/simulation.js'
import { parseArgs } from './args.mjs'

export function runSoak(seed, nights) {
  const start = performance.now()
  const results = []
  let crashes = 0
  let memStart
  let sim
  for (let i = 0; i < nights; i++) {
    const night = i % 3 + 1
    const nightSeed = seed + i
    try {
      sim = new Simulation(nightSeed, {}, night)
      if (i === 0) {
        globalThis.gc?.()
        memStart = process.memoryUsage.rss()
      }
      const random = seededRandom(nightSeed ^ 0xc53ad)
      const maxTicks = tuning[`night${night}_duration_s`] * TICK_RATE
      const input = { ...DEFAULT_INPUT }
      for (let tick = 0; tick < maxTicks && !sim.ended; tick++) {
        if (tick % 30 === 0) {
          const angle = random() * 2 * Math.PI
          input.move = [Math.cos(angle), Math.sin(angle)]
        }
        input.jump = random() < .05
        input.dash = random() < .03
        input.pulse = random() < .02
        input.interact = random() < .10
        sim.step(input)
      }
      results.push(sim.state)
    } catch (error) {
      if (i === 0) memStart ??= process.memoryUsage.rss()
      crashes++
      results.push('crash')
      process.stderr.write(`Night ${i + 1}: ${error.message}\n`)
    } finally {
      sim = undefined
    }
  }
  globalThis.gc?.()
  return { nights, crashes, results, mem_start_mb: memStart / 1048576,
    mem_end_mb: process.memoryUsage.rss() / 1048576, duration_s: (performance.now() - start) / 1000 }
}

try {
  const { seed, nights, out } = parseArgs(process.argv.slice(2), { seed: Number.MIN_SAFE_INTEGER, nights: 1 })
  writeFileSync(out, JSON.stringify(runSoak(seed, nights), null, 2) + '\n')
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 2
}
