import { writeFileSync } from 'node:fs'
import { arch, platform, release } from 'node:os'
import { performance } from 'node:perf_hooks'
import contract from '../game.contract.json' with { type: 'json' }
import { parseArgs } from './args.mjs'
import { withChrome } from './chrome.mjs'
import { serve } from './server.mjs'

try {
  const { seed, duration, out } = parseArgs(process.argv.slice(2), { seed: Number.MIN_SAFE_INTEGER, duration: 1 })
  const { server, url } = await serve(0, { board: false })
  try {
    const headless = process.env.DAO_BENCH_HEADLESS === '1'
    const software = process.env.DAO_BENCH_SOFTWARE === '1'
    const result = await withChrome({ headless, software, uncap: true }, async ({ send, on, version }) => {
      let load
      let finish
      const completed = new Promise(resolve => { finish = resolve })
      on('Runtime.exceptionThrown', ({ exceptionDetails }) =>
        finish({ error: exceptionDetails.exception?.description ?? exceptionDetails.text }))
      on('Runtime.bindingCalled', ({ name, payload }) => {
        if (name === 'daoFirstFrame') {
          const size = JSON.parse(payload)
          if (size.width !== 1280 || size.height !== 720) finish({ error: `Wrong scene size: ${payload}` })
          load = performance.now()
        }
        if (name === 'daoBenchmarkResult') finish(JSON.parse(payload))
      })
      await send('Runtime.addBinding', { name: 'daoFirstFrame' })
      await send('Runtime.addBinding', { name: 'daoBenchmarkResult' })
      console.log(`Benchmark 1280×720, ${headless ? 'headless' : 'windowed'}, 3 s warm-up + ${duration} s, seed ${seed}`)
      await send('Page.navigate', { url: `${url}?bench=1&seed=${seed}&duration=${duration}` })
      let timer
      try {
        const metrics = await Promise.race([completed, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error(`Timed out waiting for WebGL benchmark results (first frame: ${load ? 'observed' : 'missing'})`)),
            (duration + 20) * 1000)
        })])
        if (metrics.error) throw Error(metrics.error)
        if (!load) throw Error('First rendered frame was not observed')
        return { contract_version: contract.contract_version, ...metrics, load_ms: load, peak_mem_mb: null,
          vsync_off: true, renderer: `${metrics.renderer} / ${version}`, os: `${platform()} ${release()} ${arch()}` }
      } finally { clearTimeout(timer) }
    })
    writeFileSync(out, JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } finally { server.close() }
} catch (error) {
  console.error(error.message)
  process.exitCode = 2
}
