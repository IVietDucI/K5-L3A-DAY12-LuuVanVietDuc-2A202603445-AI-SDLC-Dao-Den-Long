import './game.css'
import { REVISION } from 'three'
import { GameView } from './view.js'
import { benchmarkCamera, createBenchmark, frameStats, stepBenchmark } from './benchmark-model.js'
import { TICK_RATE } from './simulation.js'

const query = new URLSearchParams(location.search)
const duration = Number(query.get('duration')) * 1000
const sim = createBenchmark(Number(query.get('seed')))
const byId = id => document.getElementById(id)
byId('round-panel').hidden = true
const view = new GameView(byId('world'), byId('markers'), byId('map'), sim, { benchmark: true })
const gl = view.renderer.getContext()
const debug = gl.getExtension('WEBGL_debug_renderer_info')
const gpu = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)

view.draw(sim, 0, benchmarkCamera(0))
gl.finish()
window.daoFirstFrame?.(JSON.stringify({ width: gl.drawingBufferWidth, height: gl.drawingBufferHeight }))

const journeyStart = performance.now()
const measureStart = journeyStart + 3000
const measureEnd = measureStart + duration
const samples = []
let previous = 0

function frame() {
  const now = performance.now()
  if (now > measureEnd) {
    try {
      window.daoBenchmarkResult?.(JSON.stringify({ ...frameStats(samples), renderer: `Three.js r${REVISION} / ${gpu}` }))
    } catch (error) {
      window.daoBenchmarkResult?.(JSON.stringify({ error: error.message }))
    }
    return
  }
  if (previous >= measureStart && now > previous) samples.push(now - previous)
  previous = now
  const seconds = (now - journeyStart) / 1000
  while (sim.simTick < Math.floor(seconds * TICK_RATE)) stepBenchmark(sim)
  view.draw(sim, 0, benchmarkCamera(seconds))
  // Count completed WebGL renders, including GPU execution.
  gl.finish()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
