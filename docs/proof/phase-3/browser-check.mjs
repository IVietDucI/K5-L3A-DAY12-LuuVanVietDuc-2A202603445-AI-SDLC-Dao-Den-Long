import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { once } from 'node:events'
import { setTimeout as wait } from 'node:timers/promises'

const [chrome, url = 'http://127.0.0.1:5173/', backend = 'swiftshader'] = process.argv.slice(2)
assert.ok(chrome, 'pass the installed Chrome executable')
assert.equal(new URL(url).hostname, '127.0.0.1')
const temp = resolve(tmpdir())
const profile = await mkdtemp(join(temp, 'dao-cp3-chrome-'))
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
  await open(url)
  assert.equal(await text('round-title'), 'Đảo Đèn Lồng')
  await click('round-button')
  assert.equal(await text('round-title'), 'Đảo Bến')
  assert.match(await text('round-detail'), /ít nhất 3 đèn/u)
  await click('round-button')

  await evalPage(`(async () => {
    const resources = performance.getEntriesByType('resource').map(entry => new URL(entry.name))
    const loaded = path => resources.find(url => url.pathname === path)?.href ?? path
    const [{ Simulation }, { GameView }] = await Promise.all([
      import(loaded('/src/simulation.js')), import(loaded('/src/view.js')),
    ])
    window.proof = { events: [] }
    const step = Simulation.prototype.step
    Simulation.prototype.step = function (input) {
      if (window.fixture) {
        window.fixture(this)
        window.fixture = null
      }
      const events = step.call(this, input)
      window.proof.events.push(...events)
      window.proof.sim = { tick: this.tick, simTick: this.simTick, state: this.state, night: this.night,
        oil: this.lanterns[0].fuelUnits, capacity: this.capacity }
      return events
    }
    const draw = GameView.prototype.draw
    GameView.prototype.draw = function (...args) {
      const result = draw.apply(this, args)
      const lamp = this.lanterns[0]
      const shade = this.shades.get('proof-shade')
      window.proof.lamp = { scaleY: lamp.casing.scale.y, tear: lamp.tear.visible, shelter: lamp.shelter.visible,
        meter: !lamp.meter.hidden, warning: !lamp.warning.hidden, blink: lamp.meter.style.getPropertyValue('--blink-opacity') }
      window.proof.shade = shade && { outline: shade.outline.color.getHexString(), eye: shade.eye.color.getHexString() }
      window.proof.ambient = this.sky.intensity
      return result
    }
  })()`)
  const fixture = (body) => evalPage(`window.fixture = sim => { ${body} }; true`)
  const key = (code, pressed) => evalPage(`window.dispatchEvent(new KeyboardEvent(${pressed ? "'keydown'" : "'keyup'"},
    {code:${JSON.stringify(code)},cancelable:true}))`)
  const hasEvent = (name) => evalPage(`window.proof.events.some(event => event.name === ${JSON.stringify(name)})`)
  const carried = () => text('carried')
  const hudSlots = () => evalPage('document.querySelectorAll("#mote-slots span:not([hidden])").length')
  await fixture(`
    sim.player.pos = [0,0,23]; sim.player.grounded = true; sim.player.vy = 0; sim.player.carried = 1;
    Object.assign(sim.lanterns[0], { lit: true, ever_lit: true, deposited: 10, fuelUnits: 24 * 60 });
    sim.shades = [sim.makeShade({ id: 'proof-shade', pos: [1.4,.85,26], state: 'stunned', state_ticks_left: 600 })];
    sim.initialTime = sim.simTick / 60 + 29;
  `)
  await until(() => evalPage('window.proof.lamp?.warning && !!window.proof.shade'))
  assert.equal(await carried(), '1 / 10')
  assert.equal(await hudSlots(), 10)
  assert.deepEqual(await evalPage('window.proof.shade'), { outline: '7a3cff', eye: '7a3cff' })
  assert.equal(await evalPage("getComputedStyle(document.getElementById('timer')).color"), 'rgb(255, 90, 95)')
  const firstBlink = await evalPage('window.proof.lamp.blink')
  await until(async () => await evalPage('window.proof.lamp.blink') !== firstBlink)

  await key('Escape', true)
  await until(async () => await text('round-title') === 'Tạm dừng')
  const paused = await evalPage('window.proof.sim')
  const blinkPaused = await evalPage('window.proof.lamp.blink')
  await click('secondary-button')
  assert.equal(await evalPage("document.getElementById('contrast').checked"), false)
  await click('contrast')
  await until(() => evalPage("window.proof.shade.eye === '00b3ff'"))
  const contrasting = await evalPage(`({
    shade: window.proof.shade,
    timer: getComputedStyle(document.getElementById('timer')).color,
    icon: getComputedStyle(document.getElementById('timer'), '::before').content,
    oilWarning: getComputedStyle(document.querySelector('[data-lantern="L1"]')).color,
  })`)
  assert.deepEqual(contrasting.shade, { outline: '00b3ff', eye: '00b3ff' })
  assert.equal(contrasting.timer, 'rgb(255, 255, 255)')
  assert.equal(contrasting.oilWarning, 'rgb(255, 255, 255)')
  assert.match(contrasting.icon, /⚠/u)
  assert.equal(await evalPage('window.proof.sim.oil'), paused.oil)
  assert.equal(await evalPage('window.proof.lamp.blink'), blinkPaused)
  await shot('settings')
  await click('settings-back')
  await click('round-button')
  await until(() => evalPage("window.proof.sim.state === 'playing'"))
  await shot('low-fuel')

  await key('KeyE', true)
  await until(() => hasEvent('refuel'))
  await key('KeyE', false)
  assert.equal(await evalPage('window.proof.lamp.shelter'), true)
  assert.equal(await evalPage('window.proof.lamp.warning'), false)

  await fixture('sim.lanterns[0].fuelUnits = 1; sim.player.carried = 5;')
  await until(() => hasEvent('lantern_out'))
  const extinguished = await evalPage('window.proof.lamp')
  assert.equal(extinguished.scaleY, .8)
  assert.equal(extinguished.tear, true)
  assert.equal(extinguished.meter, false)
  await shot('out')
  await key('KeyE', true)
  await until(() => evalPage("window.proof.events.some(event => event.name === 'lantern_lit' && event.data.relight)"))
  await key('KeyE', false)
  const relit = await evalPage('window.proof.lamp')
  assert.equal(relit.scaleY, 1)
  assert.equal(relit.tear, false)
  assert.equal(relit.meter, true)
  assert.equal(await carried(), '0 / 12')
  assert.equal(await hudSlots(), 12)
  await shot('relit')

  await fixture(`
    for (const lantern of sim.lanterns) Object.assign(lantern, { lit: true, ever_lit: true, fuelUnits: 6000 });
    sim.initialTime = sim.simTick / 60 + 5;
  `)
  await until(async () => await text('lit') === '5 / 5')
  assert.equal(await evalPage('window.proof.sim.state'), 'playing')
  await fixture(`
    for (const lantern of sim.lanterns.slice(3)) Object.assign(lantern, { lit: false, fuelUnits: 0 });
    sim.initialTime = (sim.simTick + 1) / 60;
  `)
  await until(() => evalPage("window.proof.sim.state === 'won'"))
  assert.match(await text('round-detail'), /3 đèn sáng tới bình minh/u)
  const gameOver = await evalPage("window.proof.events.find(event => event.name === 'game_over').data")
  assert.deepEqual(gameOver, { result: 'won', reason: 'dawn_survived' })
  await shot('dawn')
  await click('round-button')
  assert.equal(await text('round-title'), 'Đảo Cau')
  await click('round-button')
  await until(() => evalPage('window.proof.sim.night === 2'))
  assert.equal(await carried(), '0 / 10')
  const documentStart = await evalPage('performance.timeOrigin')
  await send('Page.reload')
  await until(() => evalPage(`performance.timeOrigin !== ${documentStart} &&
    document.getElementById('contrast')?.checked && document.getElementById('game').classList.contains('accessible-palette')`).catch(() => false))
  assert.deepEqual(exceptions, [])
  const result = {
    version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, backend,
    width: 1280, height: 720, contrasting, paused: { oilUnits: paused.oil, blink: blinkPaused },
    extinguished, relit, capacityAfterRelight: 12, capacityNextNight: 10, allLitContinues: true,
    gameOver, contrastPersists: true,
  }
  await writeFile(new URL('browser-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
} finally {
  socket?.close()
  if (browser.exitCode === null && browser.pid) browser.kill()
  await closed.catch(() => {})
  assert.equal(dirname(resolve(profile)), temp)
  await rm(profile, { recursive: true, force: true, maxRetries: 4 }).catch(() => {})
}
