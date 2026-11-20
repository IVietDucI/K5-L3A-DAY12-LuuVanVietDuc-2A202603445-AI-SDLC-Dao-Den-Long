export const validName = (value) => typeof value === 'string' && /^[A-Za-z0-9_]{3,12}$/.test(value)

export function validateEntry(entry) {
  if (!entry || !validName(entry.name) || !Number.isSafeInteger(entry.score) || entry.score < 0 ||
      !Number.isInteger(entry.nights_won) || entry.nights_won < 0 || entry.nights_won > 3 ||
      !Number.isSafeInteger(entry.seed) || typeof entry.achieved_at !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(entry.achieved_at) ||
      !Number.isFinite(Date.parse(entry.achieved_at))) throw new TypeError('Điểm hoặc tên không hợp lệ.')
  const { name, score, nights_won, achieved_at, seed } = entry
  return { name, score, nights_won, achieved_at, seed }
}

export function topEntries(entries) {
  return entries.map(validateEntry).sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at)).slice(0, 10)
}
