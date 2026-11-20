import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { once } from 'node:events'
import { setTimeout as wait } from 'node:timers/promises'

const [chrome, url = 'http://127.0.0.1:5173/', backend = 'swiftshader', fpsUrl = url] = process.argv.slice(2)
assert.ok(chrome, 'pass the installed Chrome executable')
assert.equal(new URL(url).hostname, '127.0.0.1')
assert.equal(new URL(fpsUrl).hostname, '127.0.0.1')
const temp = resolve(tmpdir())
const profile = await mkdtemp(join(temp, 'dao-cp2-chrome-'))
const browser = spawn(chrome, [
  '--headless', '--no-first-run', '--disable-background-networking', '--window-size=1280,720',
  ...(backend === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const closed = once(browser, 'exit')
closed.catch(() => {})
let socket

async function until(check) {
  for (let i = 0; i < 120; i++) {
    const result = await check()
    if (result) return result
    if (browser.exitCode !== null) throw Error(`Chrome exited with code ${browser.exitCode}`)
    await wait(100)
  }
  throw new Error('Timed out waiting for Chrome or the test page')
}

try {
  const port = await until(async () =>
    Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n')[0]))
  const endpoint = `http://127.0.0.1:${port}`
  const { Browser: version } = await (await fetch(`${endpoint}/json/version`)).json()
  const [tab] = await (await fetch(`${endpoint}/json/list`)).json()
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const pending = new Map()
  const exceptions = []
  let sequence = 0
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject, timer } = pending.get(message.id)
    clearTimeout(timer)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => reject(Error(`CDP timeout: ${method}`)), 45000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evalPage = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  const click = (id) => evalPage(`document.getElementById(${JSON.stringify(id)}).click()`)
  const text = (id) => evalPage(`document.getElementById(${JSON.stringify(id)}).textContent`)
  const open = async (address) => {
    await send('Page.navigate', { url: address })
    await until(() => evalPage(`location.href === ${JSON.stringify(address)} &&
      document.querySelectorAll('.marker').length === 5`).catch(() => false))
  }
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(new URL(`browser-${name}.png`, import.meta.url), Buffer.from(data, 'base64'))
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await open(fpsUrl)
  assert.equal(await text('round-title'), 'Đảo Đèn Lồng')
  await shot('menu')
  await click('round-button')
  assert.equal(await text('round-title'), 'Đảo Bến')
  await click('round-button')
  assert.equal(await evalPage('document.querySelectorAll("#mote-slots span").length'), 10)

  const performance = await evalPage(`new Promise(resolve => {
    const canvas = document.getElementById('world')
    const gl = canvas.getContext('webgl2')
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    let first = null
    let frames = 0
    const active = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true }))
    active('KeyW', 'keydown')
    const sample = now => {
      first ??= now
      frames++
      if (now - first < 8000) return requestAnimationFrame(sample)
      active('KeyW', 'keyup')
      resolve({ frames: frames - 1, elapsedMs: now - first, width: canvas.width, height: canvas.height, gpu })
    }
    requestAnimationFrame(sample)
  })`)
  const fps = (performance.frames * 1000 / performance.elapsedMs)
  assert.deepEqual([performance.width, performance.height], [1280, 720])
  const fpsEvidence = {
    version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, backend,
    mode: fpsUrl === url ? 'vite dev' : 'vite preview',
    ...performance, average_fps: +fps.toFixed(2), target_fps: 30, passed: fps >= 30,
  }
  await writeFile(new URL('browser-performance.json', import.meta.url), JSON.stringify(fpsEvidence, null, 2) + '\n')
  console.log(`Gameplay FPS: ${fps.toFixed(2)} on ${performance.gpu}`)

  // The gameplay build above ran normally. Use short scenarios to exercise UI transitions in the dev server.
  if (fpsUrl !== url) {
    await open(url)
    await click('round-button')
    await click('round-button')
  }
  await evalPage(`(async () => {
    const resources = performance.getEntriesByType('resource').map(entry => new URL(entry.name))
    const loaded = path => resources.find(url => url.pathname === path)?.href ?? path
    const [{ Simulation }, { NightAudio }, { GameView }] = await Promise.all([
      import(loaded('/src/simulation.js')), import(loaded('/src/audio.js')), import(loaded('/src/view.js'))])
    const originalStep = Simulation.prototype.step
    const originalTone = NightAudio.prototype.tone
    const originalEffect = NightAudio.prototype.effect
    const originalDraw = GameView.prototype.draw
    window.fixture = null
    window.proof = { effects: [], tones: 0, state: {} }
    NightAudio.prototype.tone = function (...args) {
      window.proof.tones++
      window.proof.audio = this.context?.state
      window.proof.volume = this.volume
      return originalTone.apply(this, args)
    }
    NightAudio.prototype.effect = function (name) {
      window.proof.effects.push(name)
      return originalEffect.call(this, name)
    }
    GameView.prototype.draw = function (...args) {
      const result = originalDraw.apply(this, args)
      window.proof.scene = { ambient: this.sky.intensity, sky: this.scene.background.getHexString(), fog: this.scene.fog.color.getHexString() }
      window.proof.cameraDistance = Math.hypot(this.camera.position.x - args[0].player.pos[0],
        this.camera.position.z - args[0].player.pos[2])
      return result
    }
    Simulation.prototype.step = function (input) {
      if (window.fixture) {
        window.fixture(this)
        window.fixture = null
      }
      const events = originalStep.call(this, input)
      window.proof.state = { night: this.night, tick: this.tick, simTick: this.simTick, time: this.timeLeft, state: this.state }
      return events
    }
  })()`)
  const key = (code, pressed) => evalPage(`window.dispatchEvent(new KeyboardEvent(${pressed ? "'keydown'" : "'keyup'"},
    {code:${JSON.stringify(code)},cancelable:true}))`)
  const fixture = (body) => evalPage(`window.fixture = sim => { ${body} }; true`)
  await until(() => evalPage('window.proof.tones > 0 && !!window.proof.scene'))
  assert.equal(await evalPage('window.proof.audio'), 'running')
  assert.deepEqual(await evalPage('window.proof.scene'), { ambient: .15, sky: '0e1430', fog: '1b2350' })
  await key('Escape', true)
  await until(async () => await text('round-title') === 'Tạm dừng')
  const paused = await evalPage('window.proof.state')
  await click('secondary-button')
  assert.equal(await evalPage("document.getElementById('settings-panel').hidden"), false)
  const slider = (id, value) => evalPage(`{
    const node = document.getElementById(${JSON.stringify(id)})
    node.value = ${value}
    node.dispatchEvent(new Event('input'))
  }`)
  await slider('volume', .35)
  await slider('sensitivity', 1.35)
  await shot('settings')
  const whilePaused = await evalPage('window.proof.state')
  assert.equal(whilePaused.simTick, paused.simTick)
  assert.equal(whilePaused.time, paused.time)
  await click('settings-back')
  assert.equal(await text('pause-replay'), 'Chơi lại Đêm')
  await shot('pause')
  await click('round-button')
  await until(() => evalPage("window.proof.state.state === 'playing' && window.proof.volume === 0.35"))

  await fixture(`
    sim.player.pos = sim.island.spawn.slice(); sim.player.grounded = true; sim.player.vy = 0;
    sim.player.respawning = 0; sim.player.dash = null; sim.player.launch = null;
    sim.player.flames = 3; sim.player.pulseCd = 0; sim.player.dashCd = 0;
    sim.player.carried = 2; sim.addMote(sim.player.pos);
    sim.shades = []; sim.simTick = 299; sim.initialTime = sim.simTick / 60 + 10;
  `)
  await until(() => evalPage("document.getElementById('timer').classList.contains('urgent')"))
  await key('KeyF', true)
  await until(() => evalPage("window.proof.effects.includes('pulse')"))
  await key('KeyF', false)
  await key('Space', true)
  await until(() => evalPage("window.proof.effects.includes('jump')"))
  await key('Space', false)
  await key('ShiftLeft', true)
  await until(() => evalPage("window.proof.effects.includes('dash')"))
  await key('ShiftLeft', false)
  await fixture(`
    sim.player.invuln = 0;
    sim.shades.push(sim.makeShade({pos: [sim.player.pos[0], sim.player.pos[1] + .85, sim.player.pos[2]]}));
  `)
  await until(() => evalPage("window.proof.effects.includes('player_hit')"))
  const drag = async (start, end) => {
    for (const [type, x, buttons] of [['mousePressed', start, 1], ['mouseMoved', end, 1], ['mouseReleased', end, 0]]) {
      await send('Input.dispatchMouseEvent', { type, x, y: 405, buttons, button: 'left', clickCount: 1 })
    }
  }
  const markers = () => evalPage(`Array.from(document.querySelectorAll('.marker:not([hidden])'), node => node.style.transform)`)
  const beforeDrag = await markers()
  await drag(800, 930)
  await until(async () => JSON.stringify(await markers()) !== JSON.stringify(beforeDrag))
  const finaleScores = []
  let towerCameraDistance
  for (let night = 1; night <= 3; night++) {
    if (night === 2) {
      await fixture('sim.player.flames = 0; sim.score = 777')
      await until(async () => await text('round-title') === 'Đêm chưa qua')
      await shot('retry')
      await click('round-button')
      assert.equal(await text('round-title'), 'Đảo Cau')
      await click('round-button')
    }
    await fixture(`sim.player.pos = sim.lanterns[0].pos.slice();
      sim.player.vel = [0,0,0]; sim.player.vy = 0; sim.player.dash = null; sim.player.grounded = true;
      sim.player.carried = 10; sim.initialTime = sim.simTick / 60 + 8;
      sim.lanterns.slice(1).forEach(lantern => { lantern.lit = true; lantern.deposited = 10 });`)
    await until(() => evalPage("document.getElementById('objective').textContent.includes('E — Nạp ánh sáng')"))
    if (night === 3) {
      towerCameraDistance = await evalPage('window.proof.cameraDistance')
      assert.ok(towerCameraDistance < 8, 'the tower clips the camera boom')
      await drag(760, 1092)
      await until(() => evalPage('window.proof.cameraDistance > 11'))
      await shot('tower')
    }
    await key('KeyE', true)
    await until(() => evalPage("window.proof.state.state === 'won'"))
    await key('KeyE', false)
    finaleScores.push(Number(await text('score')))
    assert.equal(await text('lit'), `${night + 4} / ${night + 4}`)
    await click('round-button')
    if (night < 3) {
      assert.equal(await text('round-title'), night === 1 ? 'Đảo Cau' : 'Đảo Chuông')
      await click('round-button')
    }
  }
  const total = finaleScores.reduce((a, b) => a + b, 0)
  assert.equal(await text('round-title'), 'Bình Minh')
  assert.equal(await text('round-detail'), `Tổng điểm · ${total}`)
  await shot('dawn')
  const audio = await evalPage('window.proof')
  assert.ok(Math.abs(audio.scene.ambient - .7) <= .00001)
  for (const sound of ['mote_picked', 'shade_spawned', 'player_hit', 'pulse', 'jump', 'dash', 'lantern_lit', 'won', 'lost', 'countdown']) {
    assert.ok(audio.effects.includes(sound), sound)
  }
  const initialDocument = await evalPage('performance.timeOrigin')
  await send('Page.reload')
  await until(() => evalPage(`performance.timeOrigin !== ${initialDocument} &&
    document.getElementById('volume-value')?.textContent === '35%' &&
    document.getElementById('sensitivity-value')?.textContent === '135%'`).catch(() => false))
  assert.equal(await text('sensitivity-value'), '135%')
  assert.deepEqual(exceptions, [])
  const result = { version, paused, whilePaused, settings: { volume: .35, sensitivity: 1.35, cameraDrag: 'passed' },
    finaleScores, total, excludedLosingScore: 777, scene: audio.scene, towerCameraDistance,
    audio: { state: audio.audio, tones: audio.tones, effects: [...new Set(audio.effects)] } }
  await writeFile(new URL('browser-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
  assert.ok(fpsEvidence.passed, `Measured ${fpsEvidence.average_fps} FPS, target ${fpsEvidence.target_fps}`)
} finally {
  socket?.close()
  if (browser.exitCode === null && browser.pid) browser.kill()
  await closed.catch(() => {})
  assert.equal(dirname(resolve(profile)), temp)
  await rm(profile, { recursive: true, force: true, maxRetries: 4 }).catch(() => {})
}
