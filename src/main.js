import './game.css'
import { Simulation, DEFAULT_INPUT, STEP, tuning } from './simulation.js'
import { GameView } from './view.js'
import { NightAudio } from './audio.js'

const get = (id) => document.getElementById(id)
const game = get('game')
const canvas = get('world')
const panel = get('round-panel')
const button = get('round-button')
const secondary = get('secondary-button')
const menuButton = get('menu-button')
const settingsPanel = get('settings-panel')
const seed = 12
const slotNodes = Array.from({ length: tuning.carry_capacity }, () => document.createElement('span'))
get('mote-slots').append(...slotNodes)

const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']
const actionKeys = ['Space', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight']
const keys = new Set()
const pending = new Set()
const outcomes = new Map()
const settings = { volume: .5, sensitivity: 1 }
try {
  const saved = JSON.parse(localStorage.getItem('dao-den-long-settings') ?? '{}')
  for (const name of Object.keys(settings)) {
    const input = get(name)
    if (Number.isFinite(saved[name])) settings[name] = Math.max(+input.min, Math.min(+input.max, saved[name]))
  }
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
let previousSecond = Math.ceil(sim.timeLeft)
let primaryAction = () => {}
let secondaryAction = () => {}
let view

function setText(id, text) {
  const element = get(id)
  if (element.textContent !== text) element.textContent = text
}

function showHud(visible) {
  for (const id of ['hud', 'map-panel', 'guide', 'inventory', 'abilities']) get(id).hidden = !visible
  game.classList.toggle('hud-active', visible)
}

function updateHud() {
  const { player } = sim
  setText('flames', '◆'.repeat(player.flames) + '◇'.repeat(tuning.flames - player.flames))
  get('flames').setAttribute('aria-label', `${player.flames} trên ${tuning.flames} Ngọn Lửa`)
  setText('carried', `${player.carried} / ${tuning.carry_capacity}`)
  slotNodes.forEach((slot, index) => slot.classList.toggle('filled', index < player.carried))
  setText('score', String(sim.score))
  const seconds = Math.ceil(sim.timeLeft)
  setText('timer', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`)
  get('timer').classList.toggle('urgent', seconds <= 30)
  setText('lit', `${sim.lanterns.filter((lantern) => lantern.lit).length} / ${sim.lanterns.length}`)
  const dashCd = player.charm > 0 ? 0 : player.dashCd
  setText('dash-info', dashCd > 0 ? `${(dashCd * STEP).toFixed(1)} s` : player.charm ? 'Bùa Gió' : 'Sẵn sàng')
  setText('pulse-info', player.pulseCd > 0 ? `${(player.pulseCd * STEP).toFixed(1)} s` : '3 đom đóm')
  get('dash-ability').classList.toggle('cooling', dashCd > 0)
  get('pulse-ability').classList.toggle('cooling', player.pulseCd > 0 || player.carried < tuning.pulse_cost)

  const nearby = sim.nearbyUnlitLantern()
  let objective = ''
  if (sim.playerInShelter()) objective = 'Vùng an toàn'
  if (sim.wind.warning) objective = 'Gió mạnh sắp nổi'
  if (nearby) objective = `E — Nạp ánh sáng (${nearby.deposited}/10)`
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
  primaryAction = onPrimary
  secondaryAction = onExtra
  settingsPanel.hidden = true
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
  openPanel({ caption: 'BA HÒN ĐẢO', title: 'Đảo Đèn Lồng', detail: 'Thắp đèn trên ba hòn đảo trước rạng đông.',
    primary: 'Chơi', onPrimary: () => showIntro(1), extra: 'Cài đặt', onExtra: openSettings })
}

function showIntro(night) {
  screen = 'intro'
  if (sim.night !== night || sim.tick !== 0) prepareNight(night)
  showHud(false)
  openPanel({ caption: `ĐÊM ${night}`, title: sim.island.name, detail: `Ông Đăng · ${sim.island.advice}`,
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
  const message = { all_lit: `Cả ${sim.lanterns.length} đèn đã sáng.`, dawn: 'Rạng đông đã đến.', no_flames: 'Mây đã cạn lửa.' }
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
}

function showDawn() {
  screen = 'dawn'
  showHud(false)
  const total = [...outcomes.values()].reduce((sum, score) => sum + score, 0)
  openPanel({ caption: 'BA ĐÊM HOÀN THÀNH', title: 'Bình Minh', detail: `Tổng điểm · ${total}`,
    primary: 'Về menu', onPrimary: showMenu })
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
  const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
  const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
  const action = (key) => keys.has(key) || pending.has(key)
  const previousTick = sim.simTick
  const wasWarning = sim.wind.warning
  const events = sim.step({
    ...DEFAULT_INPUT, move: [x, z], cam_yaw_deg: yaw * 180 / Math.PI,
    jump: action('Space'), interact: action('KeyE'), pulse: action('KeyF'),
    dash: action('ShiftLeft') || action('ShiftRight'), pause: pending.has('pause'),
  })
  pending.clear()
  for (const event of events) {
    audio.effect(event.name)
    if (event.name === 'pulse') view.showPulse(sim)
    if (event.name === 'player_hit') hitMessageUntil = sim.simTick + 65
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
  for (const id of Object.keys(settings)) {
    const input = get(id)
    const reflect = () => setText(`${id}-value`, `${Math.round(settings[id] * 100)}%`)
    input.value = settings[id]
    reflect()
    input.addEventListener('input', () => {
      settings[id] = Number(input.value)
      reflect()
      audio.setVolume(settings.volume)
      try { localStorage.setItem('dao-den-long-settings', JSON.stringify(settings)) } catch {}
    })
  }
  window.addEventListener('keydown', (event) => {
    const { code } = event
    if (code === 'Escape' && !settingsPanel.hidden) return closeSettings()
    if (screen !== 'game') return
    if ((code === 'Escape' || code === 'KeyP') && settingsPanel.hidden) {
      event.preventDefault()
      if (!event.repeat) requestPauseToggle()
      return
    }
    if (sim.state !== 'playing' || (!movementKeys.includes(code) && !actionKeys.includes(code))) return
    event.preventDefault()
    if (!event.repeat && actionKeys.includes(code)) pending.add(code)
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
  addControls()
  showMenu()
  requestAnimationFrame(frame)
} catch (error) {
  console.error(error)
  setText('round-title', 'Không mở được cảnh 3D')
  setText('round-detail', 'Hãy dùng trình duyệt có WebGL 2 và thử tải lại trang.')
  button.hidden = true
}
