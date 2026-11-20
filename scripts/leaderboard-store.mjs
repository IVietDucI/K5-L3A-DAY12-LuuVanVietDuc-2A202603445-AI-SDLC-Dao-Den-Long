import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { topEntries, validateEntry } from '../src/leaderboard.js'

export function leaderboardPath() {
  return join(process.env.DAO_DATA_DIR || join(homedir(), '.dao-den-long'), 'leaderboard.json')
}

export function readLeaderboard(path = leaderboardPath()) {
  try {
    return { entries: topEntries(JSON.parse(readFileSync(path, 'utf8')).entries) }
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [] }
    throw error
  }
}

export function saveEntry(data, path = leaderboardPath()) {
  const entry = validateEntry(data)
  const board = { entries: topEntries([...readLeaderboard(path).entries, entry]) }
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(board, null, 2) + '\n')
  renameSync(temp, path)
  return board
}

export function leaderboardApi(req, res, next) {
  if (req.url !== '/api/leaderboard') return next()
  const reply = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  if (req.method === 'GET') {
    try { reply(200, readLeaderboard()) } catch { reply(500, { error: 'Không đọc được bảng xếp hạng.' }) }
    return
  }
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })
  if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(403, { error: 'Invalid origin' })
  if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Expected JSON' })
  let text = ''
  req.setEncoding('utf8')
  req.on('data', (chunk) => {
    if (text.length > 2048) return
    text += chunk
  })
  req.on('end', () => {
    if (text.length > 2048) return reply(413, { error: 'Entry too large' })
    try {
      reply(200, saveEntry(JSON.parse(text)))
    } catch (error) {
      if (error instanceof TypeError || error instanceof SyntaxError) reply(400, { error: 'Tên hoặc điểm không hợp lệ.' })
      else reply(500, { error: 'Không ghi được bảng xếp hạng.' })
    }
  })
}
