import './game.css'
import { Simulation, STEP, tuning } from './simulation.js'
import { GameView } from './view.js'

const get = (id) => document.getElementById(id)
const game = get('game')
const canvas = get('world')
const panel = get('round-panel')
const button = get('round-button')
const seed = 12
const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']
const actionKeys = ['Space', 'KeyE', 'KeyF']
const keys = new Set()
const pending = new Set()
let sim = new Simulation(seed)
let started = false
let yaw = 0
let dragging = null
let walking = null
let lastFrame = performance.now()
let accumulator = 0
let hitMessageUntil = 0
let view

function setText(id, text) {
  const element = get(id)
  if (element.textContent !== text) element.textContent = text
}

function updateHud() {
  const { player } = sim
  setText('flames', '◆'.repeat(player.flames) + '◇'.repeat(tuning.flames - player.flames))
  get('flames').setAttribute('aria-label', `${player.flames} trên ${tuning.flames} lửa`)
  setText('carried', `${player.carried} / ${tuning.carry_capacity}`)
  setText('score', String(sim.score))
  const seconds = Math.ceil(sim.timeLeft)
  setText('timer', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`)
  get('timer').classList.toggle('urgent', seconds <= 15)
  const lit = sim.lanterns.filter((lantern) => lantern.lit).length
  setText('lit', `${lit} / ${sim.lanterns.length}`)
  setText('pulse-info', sim.tick + 1 < player.pulseReadyAt ? 'đang hồi' : `· ${tuning.pulse_cost} đom đóm`)

  const nearby = sim.nearbyUnlitLantern()
  let objective = 'Gom đom đóm và thắp 5 đèn trước rạng đông.'
  if (sim.playerInShelter()) objective = 'Vùng sáng bảo vệ Mây khỏi Bóng Mực.'
  if (nearby) {
    const need = tuning.lantern_cost - nearby.deposited
    objective = player.carried > 0
      ? `Nhấn E để nạp đèn ${nearby.id} · Còn thiếu ${need}`
      : `Đèn ${nearby.id} còn thiếu ${need} đom đóm.`
  }
  if (sim.tick < hitMessageUntil) objective = 'Bóng Mực vừa dập tắt một lửa!'
  setText('objective', objective)
}

function showResult({ result, reason }) {
  const won = result === 'won'
  setText('round-caption', won ? 'CHIẾN THẮNG' : 'KẾT THÚC')
  setText('round-title', won ? 'Đảo Bến đã sáng!' : 'Đêm chưa qua')
  const message = { all_lit: 'Cả năm Đèn Lồng Lớn đã sáng.', dawn: 'Rạng đông đã đến.', no_flames: 'Mây đã cạn lửa.' }
  setText('round-detail', `${message[reason]} Điểm của bạn · ${sim.score}`)
  button.textContent = 'Chơi lại'
  panel.hidden = false
  button.focus()
}

function resetRound() {
  sim = new Simulation(seed)
  keys.clear()
  pending.clear()
  yaw = 0
  walking = null
  accumulator = 0
  lastFrame = performance.now()
  hitMessageUntil = 0
  started = true
  panel.hidden = true
  view.reset()
  updateHud()
  game.focus()
}

function tick() {
  const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
  const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'))
  const action = (key) => keys.has(key) || pending.has(key)
  const pos = sim.player.pos.slice()
  const events = sim.step({
    move: [x, z],
    cam_yaw_deg: yaw * 180 / Math.PI,
    jump: action('Space'),
    interact: action('KeyE'),
    pulse: action('KeyF'),
  })
  pending.clear()
  walking = x || z ? [sim.player.pos[0] - pos[0], sim.player.pos[2] - pos[2]] : null
  for (const event of events) {
    if (event.name === 'pulse') view.showPulse(sim)
    if (event.name === 'player_hit') hitMessageUntil = sim.tick + 65
    if (event.name === 'game_over') {
      walking = null
      showResult(event.data)
    }
  }
}

function frame(now) {
  const active = started && sim.state === 'playing' && !document.hidden
  if (active) {
    accumulator += Math.min(.12, (now - lastFrame) / 1000)
    while (accumulator >= STEP && sim.state === 'playing') {
      tick()
      accumulator -= STEP
    }
  }
  lastFrame = now
  updateHud()
  view.draw(sim, yaw, walking, now / 1000)
  requestAnimationFrame(frame)
}

function addControls() {
  button.addEventListener('click', resetRound)
  window.addEventListener('keydown', (event) => {
    const { code } = event
    if (!started || sim.state !== 'playing' || (!movementKeys.includes(code) && !actionKeys.includes(code))) return
    event.preventDefault()
    if (!event.repeat && actionKeys.includes(code)) pending.add(code)
    keys.add(code)
  })
  window.addEventListener('keyup', ({ code }) => keys.delete(code))
  const release = () => {
    keys.clear()
    pending.clear()
    dragging = null
  }
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', () => {
    lastFrame = performance.now()
    if (document.hidden) release()
  })
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    canvas.setPointerCapture(event.pointerId)
    dragging = event.clientX
  })
  canvas.addEventListener('pointermove', (event) => {
    if (dragging === null) return
    yaw = (yaw + (event.clientX - dragging) * .007) % (Math.PI * 2)
    dragging = event.clientX
  })
  canvas.addEventListener('lostpointercapture', () => { dragging = null })
}

try {
  updateHud()
  view = new GameView(canvas, get('markers'), get('map'), sim)
  view.reset()
  addControls()
  requestAnimationFrame(frame)
} catch (error) {
  console.error(error)
  setText('round-title', 'Không mở được cảnh 3D')
  setText('round-detail', 'Hãy dùng trình duyệt có WebGL 2 và thử tải lại trang.')
  button.hidden = true
}
