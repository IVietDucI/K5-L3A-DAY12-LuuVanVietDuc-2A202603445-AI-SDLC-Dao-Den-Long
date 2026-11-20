import { defineConfig } from 'vite'
import { leaderboardApi } from './scripts/leaderboard-store.mjs'

export default defineConfig({
  base: './',
  plugins: [{
    name: 'local-leaderboard',
    configureServer(server) { server.middlewares.use(leaderboardApi) },
    configurePreviewServer(server) { server.middlewares.use(leaderboardApi) },
  }],
})
