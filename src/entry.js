if (new URLSearchParams(location.search).get('bench') === '1') {
  import('./benchmark.js').catch(error => window.daoBenchmarkResult?.(JSON.stringify({ error: error.message })))
} else {
  import('./main.js')
}
