import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import { until, withChrome } from '../../../scripts/chrome.mjs'

const prefix = resolve(tmpdir(), 'dao-cp4-ui-')
const data = await mkdtemp(prefix)
process.env.DAO_DATA_DIR = data
const client = { headless: true, software: true }
const output = (name, contents) => writeFile(new URL(name, import.meta.url), contents)
const checks = {}
const safeScript = JSON.stringify
let vite

async function page(chrome, url) {
  const { send, evaluate, on } = chrome
  const errors = []
  on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.exception?.description ?? exceptionDetails.text))
  const click = id => evaluate(`document.getElementById(${safeScript(id)}).click()`)
  const text = id => evaluate(`document.getElementById(${safeScript(id)}).textContent`)
  const key = async (code, key = code) => {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, code, key })
  }
  const open = async () => {
    await send('Page.navigate', { url })
    await until(() => evaluate('document.querySelectorAll(".marker").length === 5').catch(() => false), 'game initialization')
  }
  await open()
  return { evaluate, click, text, key, open, errors, async shot(name) {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await output(name, Buffer.from(data, 'base64'))
  } }
}

try {
  vite = await createServer({ server: { host: '127.0.0.1', port: 0 } })
  await vite.listen()
  const url = `http://127.0.0.1:${vite.httpServer.address().port}/`
  await withChrome(client, async chrome => {
    const { evaluate, click, text, key, open, errors, shot } = await page(chrome, url)
    checks.browser = chrome.version
    checks.viewport = await evaluate('[innerWidth, innerHeight]')
    assert.deepEqual(checks.viewport, [1280, 720])
    await shot('menu.png')
    await click('secondary-button')
    checks.defaultFont = await evaluate('getComputedStyle(document.querySelector(".setting")).fontSize')
    await click('large')
    await click('reduced')
    await click('contrast')
    checks.largeFont = await evaluate('getComputedStyle(document.querySelector(".setting")).fontSize')
    assert.equal(checks.defaultFont, '18px')
    assert.equal(checks.largeFont, '22.5px')
    await click('key-settings')
    checks.bindings = await evaluate('document.querySelectorAll("[data-action]").length')
    assert.equal(checks.bindings, 9)
    const select = action => evaluate(`document.querySelector('[data-action="${action}"]').click()`)
    await select('pause')
    await key('KeyE', 'e')
    checks.duplicateWarning = await text('binding-status')
    assert.match(checks.duplicateWarning, /đã dùng/u)
    await key('KeyO', 'o')
    await open()
    await click('secondary-button')
    assert.ok(await evaluate('["large", "reduced", "contrast"].every(id => document.getElementById(id).checked)'))
    await click('key-settings')
    assert.equal(await evaluate('document.querySelector("[data-action=pause]").textContent'), 'O')
    await shot('bindings.png')
    await click('keys-back')
    await click('settings-back')
    await click('round-button')
    await click('round-button')
    await key('KeyO', 'o')
    await until(async () => (await text('round-title')) === 'Tạm dừng', 'custom pause key')
    await key('KeyO', 'o')
    await until(() => evaluate('document.querySelector("#round-panel").hidden'), 'custom resume key')
    checks.pauseRemapPersists = true

    await evaluate(`(async () => {
      const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/simulation.js')
      const { Simulation } = await import(resource.name)
      const step = Simulation.prototype.step
      Simulation.prototype.step = function (input) {
        const fixture = window.daoFixture
        window.daoFixture = null
        if (fixture === 'warn') {
          Object.assign(this.lanterns[0], { lit: true, ever_lit: true, fuelUnits: 20 * 60 })
          this.simTick = 1680
          this.initialTime = (this.simTick + 540) / 60
          this.windEnabled = true
          const shade = this.makeShade({ pos: [20, .85, 0] })
          this.shades.push(shade)
          const events = step.call(this, input)
          this.emit(events, 'shade_spawned', { id: shade.id })
          return events
        }
        if (fixture === 'loss') {
          this.score = 1000
          this.player.flames = 0
        }
        if (fixture === 'win') {
          this.shades = []
          this.initialTime = (this.simTick + 1) / 60
          this.lanterns.slice(0, this.requiredLit).forEach(lantern =>
            Object.assign(lantern, { lit: true, ever_lit: true, fuelUnits: 80 * 60 }))
        }
        return step.call(this, input)
      }
    })()`)
    await evaluate('window.daoFixture = "warn"')
    await until(() => evaluate('!document.querySelector("#shade-arrow").hidden'), 'spawn direction')
    checks.captions = await text('captions')
    for (const caption of ['Bóng Mực xuất hiện', 'Gió mạnh sắp nổi', '10 giây', 'Dầu dưới 30']) {
      assert.ok(checks.captions.includes(caption), checks.captions)
    }
    checks.edge = await evaluate(`[document.querySelector("#shade-arrow").style.left, document.querySelector("#shade-arrow").style.top].map(parseFloat)`)
    assert.ok(checks.edge[0] <= 5.1 || checks.edge[0] >= 94.9 || checks.edge[1] <= 11.1 || checks.edge[1] >= 88.9)
    checks.timerAnimation = await evaluate('getComputedStyle(document.querySelector("#timer")).animationName')
    assert.equal(checks.timerAnimation, 'none')
    const minimum = await evaluate(`Math.min(...Array.from(document.querySelectorAll("#hud *, #guide *, #abilities *, .marker, #captions"))
      .filter(el => el.checkVisibility() && el.textContent.trim()).map(el => parseFloat(getComputedStyle(el).fontSize)))`)
    assert.ok(minimum >= 22.5)
    checks.largeGameplayMinimum = minimum
    await shot('accessibility.png')

    const save = async name => {
      assert.ok(await evaluate('!document.querySelector("#score-form").hidden'))
      await evaluate(`document.querySelector("#score-name").value = ${safeScript(name)}`)
      await evaluate('document.querySelector("#score-form").requestSubmit()')
      await until(async () => (await text('score-status')) === 'Đã lưu điểm.', 'saved leaderboard entry')
    }
    const win = async () => {
      await evaluate('window.daoFixture = "win"')
      await until(() => evaluate('!document.querySelector("#round-panel").hidden'), 'night win')
      const detail = await text('round-detail')
      assert.match(detail, /Điểm đêm · \d+/u)
      return Number(detail.match(/\d+$/)[0])
    }
    const next = async () => { await click('round-button'); await click('round-button') }
    const first = await win()
    await next()
    await evaluate('window.daoFixture = "loss"')
    await until(async () => (await text('round-title')) === 'Đêm chưa qua', 'loss screen')
    await save('Thu_1')
    await next()
    const second = await win()
    await next()
    const third = await win()
    await click('round-button')
    assert.equal(await text('round-title'), 'Bình Minh')
    await save('BinhMinh')
    checks.winScores = [first, second, third]
    await click('round-button')
    await click('secondary-button')
    await click('key-settings')
    await click('keys-reset')
    assert.equal(await evaluate('document.querySelector("[data-action=pause]").textContent'), 'Esc')
    assert.deepEqual(errors, [])
  })

  await withChrome(client, async chrome => {
    const { click, text, shot, errors } = await page(chrome, url)
    await click('board-button')
    await until(async () => (await text('board-list')).includes('BinhMinh'), 'leaderboard on a new browser process')
    assert.ok((await text('board-list')).includes('Thu_1'))
    await shot('leaderboard.png')
    assert.deepEqual(errors, [])
  })
  const exportPath = join(data, 'export.json')
  execFileSync(process.execPath, ['scripts/run.mjs', '--export-leaderboard', exportPath], { env: process.env })
  const exported = JSON.parse(await readFile(exportPath, 'utf8'))
  assert.deepEqual(exported.entries.map(({ name, score, nights_won }) => ({ name, score, nights_won })), [
    { name: 'BinhMinh', score: checks.winScores.reduce((sum, score) => sum + score), nights_won: 3 },
    { name: 'Thu_1', score: checks.winScores[0], nights_won: 1 },
  ])
  await output('leaderboard-export.json', JSON.stringify(exported, null, 2) + '\n')
  await output('browser-check.json', JSON.stringify(checks, null, 2) + '\n')
  console.log(JSON.stringify(checks))
} finally {
  await vite?.close()
  if (data.startsWith(prefix) && data !== prefix) await rm(data, { recursive: true, force: true })
}
