import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { once } from 'node:events'
import { setTimeout as wait } from 'node:timers/promises'

function executable() {
  if (process.env.DAO_BROWSER) return process.env.DAO_BROWSER
  if (process.platform === 'win32') {
    for (const parent of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      for (const file of ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe']) {
        const candidate = join(parent, file)
        if (existsSync(candidate)) return candidate
      }
    }
  } else if (process.platform === 'darwin') {
    const candidate = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    if (existsSync(candidate)) return candidate
  } else {
    for (const app of ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      if (spawnSync('which', [app], { stdio: 'ignore' }).status === 0) return app
    }
  }
  throw Error('Set DAO_BROWSER to an installed Chromium browser executable')
}

export async function until(check, label = 'browser condition') {
  for (let attempt = 0; attempt < 150; attempt++) {
    const result = await check()
    if (result) return result
    await wait(100)
  }
  throw Error(`Timed out waiting for ${label}`)
}

export async function withChrome({ headless, software, uncap }, use) {
  const temp = resolve(tmpdir())
  const prefix = join(temp, 'dao-cp4-chrome-')
  const profile = await mkdtemp(prefix)
  const listeners = new Map()
  const pending = new Map()
  let socket
  let browser
  let launchError
  try {
    browser = spawn(executable(), [
      ...(headless ? ['--headless', 'about:blank'] : ['--app=about:blank']),
      ...(software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
      ...(uncap ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : []),
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', '--force-device-scale-factor=1',
      '--window-size=1280,720', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    ], { stdio: 'ignore', windowsHide: headless })
    browser.on('error', error => { launchError = error })
    const endpoint = await until(async () => {
      if (launchError) throw launchError
      if (browser.exitCode !== null) throw Error(`Chromium exited with code ${browser.exitCode}`)
      const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n')[0])
      if (port) return `http://127.0.0.1:${port}`
    }, 'Chromium DevTools port')
    const { Browser: version } = await (await fetch(`${endpoint}/json/version`)).json()
    const tab = await until(async () => (await (await fetch(`${endpoint}/json/list`)).json()).find(target => target.type === 'page'))
    socket = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    let sequence = 0
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (message.method) listeners.get(message.method)?.(message.params)
      const command = pending.get(message.id)
      if (!command) return
      pending.delete(message.id)
      clearTimeout(command.timer)
      if (message.error) command.reject(Error(message.error.message))
      else command.resolve(message.result)
    })
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(Error(`CDP timeout: ${method}`))
      }, 10000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async expression => {
      const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
      if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
      return response.result.value
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
    return await use({ send, evaluate, version, on: (method, callback) => listeners.set(method, callback) })
  } finally {
    for (const command of pending.values()) {
      clearTimeout(command.timer)
      command.reject(Error('Chromium session closed'))
    }
    socket?.close()
    if (browser?.pid && browser.exitCode === null && browser.signalCode === null) {
      const closed = once(browser, 'exit').catch(() => {})
      browser.kill()
      await Promise.race([closed, wait(1200, undefined, { ref: false })])
    }
    if (resolve(profile).startsWith(temp + sep) && resolve(profile).startsWith(prefix) && profile !== prefix) {
      await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }).catch(() => {})
    }
  }
}
