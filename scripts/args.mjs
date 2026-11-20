export function parseArgs(args, numeric) {
  const allowed = new Set([...Object.keys(numeric), 'out'])
  const result = {}
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]
    const name = flag.slice(2)
    const value = args[i + 1]
    if (!flag.startsWith('--') || !allowed.has(name) || Object.hasOwn(result, name) || !value || value.startsWith('--')) {
      throw new Error(`Invalid argument ${flag}`)
    }
    result[name] = value
  }
  for (const [name, min] of Object.entries(numeric)) {
    const number = Number(result[name])
    if (!/^-?\d+$/.test(result[name]) || !Number.isSafeInteger(number) || number < min) {
      throw new Error(`--${name} must be an integer >= ${min}`)
    }
    result[name] = number
  }
  if (!result.out) throw new Error('--out is required')
  return result
}
