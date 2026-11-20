import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { readLeaderboard } from './leaderboard-store.mjs'
import { serve } from './server.mjs'

try {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === '--export-leaderboard' && args[1]) {
    writeFileSync(args[1], JSON.stringify(readLeaderboard(), null, 2) + '\n')
  } else if (args.length === 0 || (args.length === 1 && args[0] === '--no-open')) {
    const { url } = await serve(Number(process.env.DAO_PORT ?? 4173))
    console.log(`Đảo Đèn Lồng · ${url}`)
    if (!args.length) {
      const [app, ...openArgs] = process.platform === 'win32' ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url] :
        process.platform === 'darwin' ? ['open', url] : ['xdg-open', url]
      spawn(app, openArgs, { stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref()
    }
  } else throw Error('Usage: node scripts/run.mjs [--no-open | --export-leaderboard out.json]')
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 2
}
