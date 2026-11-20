import './game.css'
import { Simulation, DEFAULT_INPUT, STEP, fuelOf, isWeak, tuning } from './simulation.js'
import { GameView } from './view.js'
import { NightAudio } from './audio.js'
import { installBoard } from './board-ui.js'
import { activeKeys, bindingError, defaultKeys, describeKey, keyLabels, loadKeys } from './keymap.js'

const get = (id) => document.getElementById(id)
const game = get('game')
const canvas = get('world')
const panel = get('round-panel')
const button = get('round-button')
const secondary = get('secondary-button')
const menuButton = get('menu-button')
const settingsPanel = get('settings-panel')
const keysPanel = get('keys-panel')
const seed = 12
const slotNodes = Array.from({ length: tuning.capacity_max }, () => document.createElement('span'))
get('mote-slots').append(...slotNodes)

const movement = ['forward', 'back', 'left', 'right']
const keys = new Set()
const pending = new Set()
const outcomes = new Map()
const ranges = ['volume', 'sensitivity']
const settings = { volume: .5, sensitivity: 1, contrast: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, large: false, bindings: { ...defaultKeys } }
try {
  const saved = JSON.parse(localStorage.getItem('dao-den-long-settings') ?? '{}')
  for (const name of ranges) {
    const input = get(name)
    if (Number.isFinite(saved[name])) settings[name] = Math.max(+input.min, Math.min(+input.max, saved[name]))
  }
  settings.contrast = saved.contrast === true
  if (typeof saved.reduced === 'boolean') settings.reduced = saved.reduced
  settings.large = saved.large === true
  settings.bindings = loadKeys(saved.bindings)
} catch {
  // The defaults also work if storage is unavailable.
}
const audio = new NightAudio(settings.volume)
let sim = new Simulation(seed)
let screen = 'menu'
let yaw = Math.PI
let dragging = null
let lastFrame = performance.now()
let accumulator = 0
let hitMessageUntil = 0
let spawnNotice
let keyCapture
let keyboard
let previousSecond = Math.ceil(sim.timeLeft)
let primaryAction = () => {}
let secondaryAction = () => {}
let view
let board

function setText(id, text) {
  const element = get(id)
  if (element.textContent !== text) element.textContent = text
}

function showHud(visible) {
  for (const id of ['hud', 'map-panel', 'guide', 'inventory', 'abilities']) get(id).hidden = !visible
  game.classList.toggle('hud-active', visible)
}

function updateCaptions(seconds) {
  const messages = []
  const shade = spawnNotice && sim.simTick < spawnNotice.until && sim.shades.find(({ id }) => id === spawnNotice.id)
  const arrow = get('shade-arrow')
  arrow.hidden = !shade
  if (shade) {
    messages.push('Bóng Mực xuất hiện')
    const dx = shade.pos[0] - sim.player.pos[0]
    const dz = shade.pos[2] - sim.player.pos[2]
    const angle = Math.atan2(dx * Math.cos(yaw) - dz * Math.sin(yaw), -dx * Math.sin(yaw) - dz * Math.cos(yaw))
    const horizontal = Math.sin(angle)
    const vertical = -Math.cos(angle)
    const edge = Math.min(45 / Math.abs(horizontal), 39 / Math.abs(vertical))
    arrow.style.left = `${50 + horizontal * edge}%`
    arrow.style.top = `${50 + vertical * edge}%`
    arrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`
  }
  if (sim.wind.warning) messages.push('Gió mạnh sắp nổi')
  if (seconds <= 10 && seconds > 0) messages.push('Còn không quá 10 giây')
  const low = sim.lanterns.filter(isWeak).map(({ id }) => id)
  if (low.length) messages.push(`Dầu dưới 30 · ${low.join(', ')}`)
  setText('captions', messages.join('  |  '))
  get('captions').hidden = messages.length === 0
}

function updateHud() {
  const { player } = sim
  setText('flames', '◆'.repeat(player.flames) + '◇'.repeat(tuning.flames - player.flames))
  get('flames').setAttribute('aria-label', `${player.flames} trên ${tuning.flames} Ngọn Lửa`)
  const capacity = sim.capacity
  setText('carried', `${player.carried} / ${capacity}`)
  get('mote-slots').style.setProperty('--slots', capacity)
  slotNodes.forEach((slot, index) => {
    slot.hidden = index >= capacity
    slot.classList.toggle('filled', index < player.carried)
  })
  setText('score', String(sim.score))
  const seconds = Math.ceil(sim.timeLeft)
  updateCaptions(seconds)
  setText('timer', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`)
  get('timer').classList.toggle('urgent', seconds <= 30)
  setText('lit', `${sim.lanterns.filter((lantern) => lantern.lit).length} / ${sim.lanterns.length}`)
  const dashCd = player.charm > 0 ? 0 : player.dashCd
  setText('dash-info', dashCd > 0 ? `${(dashCd * STEP).toFixed(1)} s` : player.charm ? 'Bùa Gió' : 'Sẵn sàng')
  setText('pulse-info', player.pulseCd > 0 ? `${(player.pulseCd * STEP).toFixed(1)} s` : '3 đom đóm')
  get('dash-ability').classList.toggle('cooling', dashCd > 0)
  get('pulse-ability').classList.toggle('cooling', player.pulseCd > 0 || player.carried < tuning.pulse_cost)

  const nearby = sim.nearbyLantern()
  let objective = ''
  if (sim.playerInShelter()) objective = 'Vùng an toàn'
  const interact = describeKey(settings.bindings.interact)
  if (nearby?.lit) objective = `${interact} — Châm dầu (${fuelOf(nearby).toFixed(1).replace('.', ',')}/${tuning.fuel_max})`
  else if (nearby) objective = `${interact} — Nạp ánh sáng (${nearby.deposited}/${nearby.ever_lit ? tuning.relight_cost : tuning.lantern_cost})`
  if (sim.simTick < hitMessageUntil) objective = 'Mây vừa mất một Ngọn Lửa'
  if (player.respawning > 0) objective = 'Mây đang trở lại điểm xuất phát'
  setText('objective', objective)
  get('objective').hidden = objective === ''
}

function openPanel({ caption, title, detail, primary, onPrimary, extra, onExtra, menu = false }) {
  setText('round-caption', caption)
  setText('round-title', title)
  setText('round-detail', detail)
  setText('round-button', primary)
  setText('secondary-button', extra ?? '')
  secondary.hidden = !extra
  menuButton.hidden = !menu
  get('board-button').hidden = true
  board.hide()
  primaryAction = onPrimary
  secondaryAction = onExtra
  settingsPanel.hidden = true
  keysPanel.hidden = true
  panel.hidden = false
  button.focus()
}

function clearInput() {
  keys.clear()
  pending.clear()
  dragging = null
}

function prepareNight(night) {
  sim = new Simulation(seed, {}, night)
  view.load(sim)
  yaw = Math.PI
  clearInput()
  accumulator = 0
  hitMessageUntil = 0
  spawnNotice = null
  previousSecond = Math.ceil(sim.timeLeft)
  setText('night-label', `ĐÊM ${night} · ${sim.island.name.toUpperCase()}`)
  updateHud()
}

function showMenu() {
  screen = 'menu'
  audio.music(false)
  outcomes.clear()
  prepareNight(1)
  showHud(false)
  openPanel({ caption: 'BA HÒN ĐẢO', title: 'Đảo Đèn Lồng', detail: 'Giữ đèn sáng trên ba hòn đảo tới bình minh.',
    primary: 'Chơi', onPrimary: () => showIntro(1), extra: 'Cài đặt', onExtra: openSettings })
  get('board-button').hidden = false
}

function showIntro(night) {
  screen = 'intro'
  if (sim.night !== night || sim.tick !== 0) prepareNight(night)
  showHud(false)
  openPanel({ caption: `ĐÊM ${night}`, title: sim.island.name,
    detail: `Ông Đăng · Giữ ít nhất ${sim.requiredLit} đèn sáng tới bình minh. ${sim.island.advice}`,
    primary: 'Bắt đầu', onPrimary: beginPlay, menu: true })
}

function resumeSound() {
  const playing = sim
  audio.unlock().then(() => {
    if (sim === playing && screen === 'game' && sim.state === 'playing' && !document.hidden) audio.music(true, sim.night)
  }).catch(() => {})
}

function beginPlay() {
  screen = 'game'
  lastFrame = performance.now()
  accumulator = 0
  panel.hidden = true
  showHud(true)
  resumeSound()
  game.focus()
}

function showResult({ result, reason }) {
  screen = 'result'
  clearInput()
  audio.music(false)
  audio.effect(result)
  const won = result === 'won'
  const night = sim.night
  if (won) outcomes.set(night, sim.score)
  const message = {
    dawn_survived: `Mây giữ được ${sim.lanterns.filter(({ lit }) => lit).length} đèn sáng tới bình minh.`,
    dawn: `Rạng đông đã đến, cần ít nhất ${sim.requiredLit} đèn sáng.`,
    no_flames: 'Mây đã cạn lửa.',
  }
  openPanel({
    caption: won ? 'CHIẾN THẮNG' : 'KẾT THÚC', title: won ? `${sim.island.name} đã sáng!` : 'Đêm chưa qua',
    detail: `${message[reason]} Điểm đêm · ${sim.score}`,
    primary: won ? night < 3 ? 'Đêm kế tiếp' : 'Đón bình minh' : 'Chơi lại',
    onPrimary: () => {
      if (!won) showIntro(night)
      else if (night < 3) showIntro(night + 1)
      else showDawn()
    },
    menu: true,
  })
  if (!won) offerScore()
}

function offerScore() {
  const score = [...outcomes.values()].reduce((sum, nightScore) => sum + nightScore, 0)
  board.offer({ score, nights_won: outcomes.size, seed })
}

function showDawn() {
  screen = 'dawn'
  showHud(false)
  const total = [...outcomes.values()].reduce((sum, score) => sum + score, 0)
  openPanel({ caption: 'BA ĐÊM HOÀN THÀNH', title: 'Bình Minh', detail: `Tổng điểm · ${total}`,
    primary: 'Về menu', onPrimary: showMenu })
  offerScore()
}

function requestPauseToggle() {
  pending.add('pause')
}

function showPause() {
  keys.clear()
  audio.music(false)
  openPanel({
    caption: `ĐÊM ${sim.night} · ${sim.island.name.toUpperCase()}`, title: 'Tạm dừng', detail: 'Bạn có thể tiếp tục bất cứ lúc nào.',
    primary: 'Tiếp tục', onPrimary: requestPauseToggle, extra: 'Cài đặt', onExtra: openSettings, menu: true,
  })
  const replay = document.createElement('button')
  replay.id = 'pause-replay'
  replay.className = 'secondary'
  replay.textContent = 'Chơi lại Đêm'
  replay.addEventListener('click', () => {
    replay.remove()
    showIntro(sim.night)
  })
  secondary.before(replay)
}

function openSettings() {
  panel.hidden = true
  settingsPanel.hidden = false
  get('settings-back').focus()
}

function closeSettings() {
  settingsPanel.hidden = true
  panel.hidden = false
  button.focus()
}

function tick() {
  const held = action => keyboard[action].some(code => keys.has(code))
  const action = name => held(name) || pending.has(name)
  const x = Number(held('right')) - Number(held('left'))
  const z = Number(held('back')) - Number(held('forward'))
  const previousTick = sim.simTick
  const wasWarning = sim.wind.warning
  const events = sim.step({
    ...DEFAULT_INPUT, move: [x, z], cam_yaw_deg: yaw * 180 / Math.PI,
    jump: action('jump'), interact: action('interact'), pulse: action('pulse'),
    dash: action('dash'), pause: pending.has('pause'),
  })
  pending.clear()
  for (const event of events) {
    audio.effect(event.name)
    if (event.name === 'pulse') view.showPulse(sim)
    if (event.name === 'player_hit') hitMessageUntil = sim.simTick + 65
    if (event.name === 'shade_spawned') spawnNotice = { id: event.data.id, until: sim.simTick + 180 }
    if (event.name === 'paused') showPause()
    if (event.name === 'resumed') {
      get('pause-replay')?.remove()
      panel.hidden = true
      resumeSound()
      game.focus()
    }
    if (event.name === 'game_over') showResult(event.data)
  }
  if (sim.simTick !== previousTick) {
    if (sim.player.jumped) audio.effect('jump')
    if (sim.wind.warning && !wasWarning) audio.effect('wind')
    const second = Math.ceil(sim.timeLeft)
    if (second !== previousSecond && second <= 10 && second > 0) audio.effect('countdown')
    previousSecond = second
  }
}

function frame(now) {
  const active = screen === 'game' && !sim.ended && !document.hidden
  if (active) {
    accumulator += Math.min(.15, (now - lastFrame) / 1000)
    while (accumulator >= STEP && screen === 'game' && !sim.ended) {
      tick()
      accumulator -= STEP
    }
  }
  lastFrame = now
  updateHud()
  view.draw(sim, yaw)
  requestAnimationFrame(frame)
}

function addControls() {
  button.addEventListener('click', () => primaryAction())
  secondary.addEventListener('click', () => secondaryAction?.())
  menuButton.addEventListener('click', () => {
    get('pause-replay')?.remove()
    showMenu()
  })
  get('settings-back').addEventListener('click', closeSettings)
  get('board-button').addEventListener('click', board.show)
  const saveSettings = () => {
    try { localStorage.setItem('dao-den-long-settings', JSON.stringify(settings)) } catch {}
  }
  for (const id of ranges) {
    const input = get(id)
    const reflect = () => setText(`${id}-value`, `${Math.round(settings[id] * 100)}%`)
    input.value = settings[id]
    reflect()
    input.addEventListener('input', () => {
      settings[id] = Number(input.value)
      reflect()
      audio.setVolume(settings.volume)
      saveSettings()
    })
  }
  const applyToggles = () => {
    game.classList.toggle('accessible-palette', settings.contrast)
    game.classList.toggle('reduced-motion', settings.reduced)
    document.documentElement.classList.toggle('large-text', settings.large)
    view.highContrast = settings.contrast
    view.reducedMotion = settings.reduced
  }
  for (const name of ['contrast', 'reduced', 'large']) {
    const input = get(name)
    input.checked = settings[name]
    input.addEventListener('change', () => {
      settings[name] = input.checked
      applyToggles()
      saveSettings()
    })
  }
  applyToggles()
  const bindingButtons = new Map()
  for (const [action, label] of Object.entries(keyLabels)) {
    const row = document.createElement('div')
    const name = document.createElement('span')
    name.textContent = label
    const bind = document.createElement('button')
    bind.type = 'button'
    bind.className = 'secondary'
    bind.dataset.action = action
    bind.addEventListener('click', () => {
      keyCapture = action
      setText('binding-status', `Bấm phím mới cho ${label}.`)
    })
    row.append(name, bind)
    get('bindings').append(row)
    bindingButtons.set(action, bind)
  }
  const reflectBindings = () => {
    keyboard = Object.fromEntries(Object.keys(defaultKeys).map(action => [action, activeKeys(settings.bindings, action)]))
    setText('move-keys', ['forward', 'left', 'back', 'right'].map(action => describeKey(settings.bindings[action])).join(' '))
    for (const label of document.querySelectorAll('[data-key]')) label.textContent = describeKey(settings.bindings[label.dataset.key])
    for (const [action, bind] of bindingButtons) {
      bind.textContent = describeKey(settings.bindings[action])
      bind.setAttribute('aria-label', `${keyLabels[action]} · ${bind.textContent}`)
    }
  }
  reflectBindings()
  const closeKeys = () => {
    keyCapture = null
    keysPanel.hidden = true
    settingsPanel.hidden = false
    get('key-settings').focus()
  }
  get('key-settings').addEventListener('click', () => {
    settingsPanel.hidden = true
    keysPanel.hidden = false
    setText('binding-status', '')
    bindingButtons.get('forward').focus()
  })
  get('keys-back').addEventListener('click', closeKeys)
  get('keys-reset').addEventListener('click', () => {
    keyCapture = null
    settings.bindings = { ...defaultKeys }
    reflectBindings()
    saveSettings()
    setText('binding-status', 'Đã khôi phục phím mặc định.')
  })
  window.addEventListener('keydown', (event) => {
    const { code } = event
    if (!keysPanel.hidden) {
      if (keyCapture) {
        if (code === 'Tab') return
        event.preventDefault()
        if (event.repeat) return
        const error = bindingError(settings.bindings, keyCapture, code)
        if (error) return setText('binding-status', error)
        settings.bindings[keyCapture] = code
        keyCapture = null
        reflectBindings()
        saveSettings()
        return setText('binding-status', 'Đã lưu phím.')
      }
      if (code === 'Escape') closeKeys()
      return
    }
    if (code === 'Escape' && !settingsPanel.hidden) return closeSettings()
    if (screen !== 'game' || !settingsPanel.hidden) return
    const action = Object.keys(keyboard).find(name => keyboard[name].includes(code))
    if (action === 'pause' && (sim.state === 'playing' || code !== 'Enter')) {
      event.preventDefault()
      if (!event.repeat) requestPauseToggle()
      return
    }
    if (sim.state !== 'playing' || !action) return
    event.preventDefault()
    if (!event.repeat && !movement.includes(action)) pending.add(action)
    keys.add(code)
  })
  window.addEventListener('keyup', ({ code }) => keys.delete(code))
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', () => {
    lastFrame = performance.now()
    if (document.hidden) {
      clearInput()
      audio.music(false)
    } else if (screen === 'game' && sim.state === 'playing') resumeSound()
  })
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || screen !== 'game' || sim.state !== 'playing') return
    canvas.setPointerCapture(event.pointerId)
    dragging = event.clientX
  })
  canvas.addEventListener('pointermove', (event) => {
    if (dragging === null) return
    yaw = (yaw + (event.clientX - dragging) * .007 * settings.sensitivity) % (Math.PI * 2)
    dragging = event.clientX
  })
  canvas.addEventListener('lostpointercapture', () => { dragging = null })
}

try {
  view = new GameView(canvas, get('markers'), get('map'), sim)
  board = installBoard(showMenu)
  addControls()
  showMenu()
  requestAnimationFrame(frame)
} catch (error) {
  console.error(error)
  setText('round-title', 'Không mở được cảnh 3D')
  setText('round-detail', 'Hãy dùng trình duyệt có WebGL 2 và thử tải lại trang.')
  button.hidden = true
}
