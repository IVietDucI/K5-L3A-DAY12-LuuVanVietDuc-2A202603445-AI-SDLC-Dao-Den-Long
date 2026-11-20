import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { once } from 'node:events'
import { setTimeout } from 'node:timers/promises'

const [chrome, url = 'http://127.0.0.1:5173/'] = process.argv.slice(2)
assert.ok(chrome, 'pass the installed Chrome executable and the local Vite URL')
assert.equal(new URL(url).hostname, '127.0.0.1', 'use the local test server')
const temp = resolve(tmpdir())
const profile = await mkdtemp(join(temp, 'dao-chrome-'))
const browser = spawn(chrome, [
  '--headless', '--no-first-run', '--disable-background-networking',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const closed = once(browser, 'exit')
closed.catch(() => {})
let socket

async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await check()
    if (value) return value
    if (browser.exitCode !== null) throw new Error(`Chrome exited with code ${browser.exitCode}`)
    await setTimeout(100)
  }
  throw new Error('Timed out waiting for Chrome')
}

try {
  const port = await until(async () => {
    const info = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')
    return Number(info.split('\n')[0])
  })
  const debuggerUrl = `http://127.0.0.1:${port}`
  const { Browser: version } = await (await fetch(`${debuggerUrl}/json/version`)).json()
  const [tab] = await (await fetch(`${debuggerUrl}/json/list`)).json()
  socket = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    socket.addEventListener('open', done, { once: true })
    socket.addEventListener('error', fail, { once: true })
  })
  let nextId = 0
  const requests = new Map()
  const exceptions = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    if (!message.id) return
    const { done, fail } = requests.get(message.id)
    requests.delete(message.id)
    if (message.error) fail(new Error(message.error.message))
    else done(message.result)
  })
  const send = (method, params = {}) => new Promise((done, fail) => {
    const id = ++nextId
    requests.set(id, { done, fail })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description)
    return result.result.value
  }
  const dom = async () => evaluate(`Object.fromEntries(
    ['carried', 'score', 'flames', 'lit', 'timer', 'round-title', 'round-button', 'pulse-info']
      .map(id => [id, document.getElementById(id).textContent])
  )`)
  const screenshot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(new URL(name, import.meta.url), Buffer.from(data, 'base64'))
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  // Keep playback deterministic while exercising the app's actual frame loop and keyboard handlers.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__qa = {
      clock: 100, frames: [],
      step(ticks) {
        for (let left = ticks; left > 0;) {
          const batch = Math.min(6, left)
          this.clock += batch * (1000 / 60 + 0.00001)
          const callbacks = this.frames.splice(0)
          for (const callback of callbacks) callback(this.clock)
          left -= batch
        }
      },
      key(code, on) {
        window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, cancelable: true }))
      },
    }
    performance.now = () => window.__qa.clock
    window.requestAnimationFrame = callback => window.__qa.frames.push(callback)
  ` })
  await send('Page.navigate', { url })
  await until(() => evaluate('window.__qa?.frames.length > 0').catch(() => false))
  assert.equal(await evaluate('document.querySelectorAll(".marker").length'), 5)
  assert.equal((await dom()).timer, '2:00')
  await evaluate('__qa.step(1)')
  await screenshot('browser-start.png')

  await evaluate(`
    document.getElementById('round-button').click()
    __qa.key('KeyW', true); __qa.step(15); __qa.key('KeyW', false)
    __qa.key('Space', true); __qa.key('KeyS', true); __qa.step(34)
    __qa.key('Space', false); __qa.key('KeyS', false)
  `)
  assert.equal((await dom()).carried, '2 / 8')
  await evaluate(`__qa.key('KeyF', true); __qa.step(1); __qa.key('KeyF', false)`)
  const afterPulse = await dom()
  assert.equal(afterPulse.carried, '0 / 8')
  assert.match(afterPulse['pulse-info'], /hồi/u)

  const markerPositions = () => evaluate(`Array.from(document.querySelectorAll('.marker:not([hidden])'), node => node.style.transform)`)
  const beforeDrag = await markerPositions()
  for (const [type, x, buttons] of [['mousePressed', 900, 1], ['mouseMoved', 1040, 1], ['mouseReleased', 1040, 0]]) {
    await send('Input.dispatchMouseEvent', { type, x, y: 500, buttons, button: 'left', clickCount: 1 })
  }
  await evaluate('__qa.step(1)')
  assert.notDeepEqual(await markerPositions(), beforeDrag)
  await evaluate('__qa.step(1500)')
  const loss = await dom()
  assert.equal(loss['round-title'], 'Đêm chưa qua')
  assert.equal(loss.flames, '◇◇◇')
  assert.equal(loss['round-button'], 'Chơi lại')
  await screenshot('browser-lost.png')

  await evaluate(`document.getElementById('round-button').click()`)
  const reset = await dom()
  assert.equal(reset.carried, '0 / 8')
  assert.equal(reset.score, '0')
  assert.equal(reset.lit, '0 / 5')
  assert.equal(reset.flames, '◆◆◆')
  assert.equal(reset.timer, '2:00')
  const { frames } = JSON.parse(await readFile(new URL('full-night.inputs.json', import.meta.url), 'utf8'))
  await evaluate(`
    {
      const route = ${JSON.stringify(frames)};
      route.forEach(({ move: [x, z], interact, tick }, index) => {
        __qa.key('KeyA', x < 0); __qa.key('KeyD', x > 0);
        __qa.key('KeyW', z < 0); __qa.key('KeyS', z > 0);
        __qa.key('KeyE', interact);
        __qa.step((route[index + 1]?.tick ?? tick + 1) - tick);
      });
    }
  `)
  const win = await dom()
  assert.equal(win['round-title'], 'Đảo Bến đã sáng!')
  assert.equal(win.lit, '5 / 5')
  assert.equal(win.score, '926')
  await screenshot('browser-won.png')
  await evaluate(`document.getElementById('round-button').click()`)
  assert.deepEqual(await dom(), { ...reset, 'round-title': win['round-title'] })
  assert.equal(await evaluate("document.getElementById('round-panel').hidden"), true)
  assert.deepEqual(exceptions, [])
  console.log(JSON.stringify({ version, afterPulse, cameraDrag: 'passed', loss, reset, win, replayAfterWin: 'passed' }, null, 2))
} finally {
  socket?.close()
  if (browser.exitCode === null && browser.pid) browser.kill()
  await closed.catch(() => {})
  assert.equal(dirname(resolve(profile)), temp)
  await rm(profile, { recursive: true, force: true, maxRetries: 4 }).catch(() => {})
}
