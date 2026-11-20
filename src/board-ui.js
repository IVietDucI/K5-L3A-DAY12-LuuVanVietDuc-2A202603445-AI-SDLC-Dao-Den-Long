import { topEntries, validName } from './leaderboard.js'

const storage = 'dao-den-long-leaderboard'
async function request(entry) {
  const url = new URL('./api/leaderboard', location.href)
  const response = await fetch(url, entry ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry) } : { cache: 'no-store' })
  const json = response.headers.get('Content-Type')?.includes('application/json')
  if (response.status === 404 || (!json && [200, 405, 501].includes(response.status))) {
    const current = JSON.parse(localStorage.getItem(storage) ?? '{"entries":[]}')
    const entries = topEntries(entry ? [...current.entries, entry] : current.entries)
    if (entry) localStorage.setItem(storage, JSON.stringify({ entries }))
    return entries
  }
  if (!response.ok) throw Error((json && (await response.json()).error) || 'Không truy cập được bảng xếp hạng.')
  return (await response.json()).entries
}

export function installBoard(showMenu) {
  const board = document.getElementById('board-panel')
  const list = document.getElementById('board-list')
  const message = document.getElementById('board-message')
  const form = document.getElementById('score-form')
  const name = document.getElementById('score-name')
  const status = document.getElementById('score-status')
  let run
  const show = async () => {
    document.getElementById('round-panel').hidden = true
    board.hidden = false
    document.getElementById('board-back').focus()
    list.replaceChildren()
    message.textContent = 'Đang tải…'
    try {
      const entries = await request()
      message.textContent = entries.length ? '' : 'Chưa có điểm.'
      for (const entry of entries) {
        const row = document.createElement('li')
        row.textContent = `${entry.name} · ${entry.score} điểm · ${entry.nights_won}/3 đêm`
        list.append(row)
      }
    } catch (error) { message.textContent = error.message }
  }
  document.getElementById('board-back').addEventListener('click', () => {
    board.hidden = true
    showMenu()
  })
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const attempt = run
    if (!attempt || attempt.saved || attempt.saving) return
    if (!validName(name.value)) {
      status.textContent = 'Dùng 3–12 ký tự A–Z, 0–9 hoặc dấu gạch dưới.'
      return
    }
    attempt.saving = true
    form.querySelector('button').disabled = true
    try {
      await request({ ...attempt.entry, name: name.value, achieved_at: new Date().toISOString() })
      attempt.saved = true
      if (run === attempt) status.textContent = 'Đã lưu điểm.'
    } catch (error) {
      if (run === attempt) status.textContent = error.message
    } finally {
      attempt.saving = false
      if (run === attempt) form.querySelector('button').disabled = attempt.saved
    }
  })
  return {
    show,
    offer(entry) {
      run = { entry, saving: false, saved: false }
      form.reset()
      form.querySelector('button').disabled = false
      status.textContent = ''
      form.hidden = false
    },
    hide() { run = undefined; form.hidden = true },
  }
}
