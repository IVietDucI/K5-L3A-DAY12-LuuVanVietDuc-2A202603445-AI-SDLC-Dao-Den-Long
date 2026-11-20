import { Simulation, seededRandom } from './simulation.js'

function disk(count, radius, angle) {
  return Array.from({ length: count }, (_, index) => {
    const distance = radius * Math.sqrt((index + .5) / count)
    const azimuth = angle + index * Math.PI * (3 - Math.sqrt(5))
    return [distance * Math.cos(azimuth), 0, distance * Math.sin(azimuth)]
  })
}

export function createBenchmark(seed) {
  const random = seededRandom(seed)
  return new Simulation(seed, {
    player: { pos: [0, 0, 0] },
    motes: disk(100, 38, random() * 2 * Math.PI),
    shades: disk(200, 38, random() * 2 * Math.PI).map(([x, , z]) => ({ pos: [x, .85, z], state: 'wander' })),
    lanterns: [1, 2, 3].map(index => ({ id: `L${index}`, lit: true, fuel: 100 })),
  }, 1)
}

export function stepBenchmark(sim) {
  sim.simTick++
  sim.moveShades(true)
}

export function benchmarkCamera(seconds) {
  const angle = seconds * 2 * Math.PI / 15
  return [30 * Math.cos(angle), 15, -30 * Math.sin(angle)]
}

export function frameStats(samples) {
  const frames = samples.length
  if (!frames) throw Error('No complete frames in the measurement window')
  const sorted = [...samples].sort((a, b) => a - b)
  const total = sorted.reduce((sum, time) => sum + time, 0)
  const tail = sorted.slice(-Math.max(1, Math.ceil(frames * .01)))
  const slow = tail.reduce((sum, time) => sum + time, 0) / tail.length
  return { avg_fps: 1000 * frames / total, p1_low_fps: 1000 / slow,
    frame_ms_p95: sorted[Math.ceil(frames * .95) - 1], frames }
}
