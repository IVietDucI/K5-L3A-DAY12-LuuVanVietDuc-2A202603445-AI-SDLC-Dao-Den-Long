import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { leaderboardApi } from './leaderboard-store.mjs'

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png' }

export async function serve(port, { board = true } = {}) {
  const directory = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
  statSync(resolve(directory, 'index.html'))
  const server = createServer((req, res) => {
    const assets = () => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        const file = resolve(directory, '.' + (path === '/' ? '/index.html' : path))
        if (!file.startsWith(directory + sep) || !['GET', 'HEAD'].includes(req.method) || !statSync(file).isFile()) throw Error()
        res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream')
        if (req.method === 'HEAD') res.end()
        else createReadStream(file).on('error', () => res.destroy()).pipe(res)
      } catch {
        res.writeHead(404).end('Not found')
      }
    }
    if (board) leaderboardApi(req, res, assets)
    else assets()
  })
  server.listen(port, '127.0.0.1')
  await once(server, 'listening')
  return { server, url: `http://127.0.0.1:${server.address().port}/` }
}
