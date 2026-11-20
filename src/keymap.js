export const defaultKeys = Object.freeze({
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space',
  dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape',
})
export const keyLabels = { forward: 'Tiến', back: 'Lùi', left: 'Trái', right: 'Phải', jump: 'Nhảy',
  dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa Sáng', pause: 'Tạm dừng' }
const bindable = /^(?:Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Escape|Shift(?:Left|Right)|Enter|Backspace|Bracket(?:Left|Right)|Comma|Period|Slash|Minus|Equal|Semicolon|Quote|Backquote|Backslash|Numpad[0-9])$/
const aliases = {
  forward: ['ArrowUp'], back: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  dash: ['ShiftRight'], pause: ['KeyP'],
}
export function bindingError(bindings, action, code) {
  if (!bindable.test(code)) return 'Hãy chọn một phím chơi game.'
  const other = Object.keys(defaultKeys).find((key) => key !== action && bindings[key] === code)
  return other ? `Phím này đã dùng cho ${keyLabels[other]}.` : ''
}
export function activeKeys(bindings, action) {
  const primary = bindings[action]
  return primary === defaultKeys[action]
    ? [primary, ...(aliases[action] ?? []).filter(code => !Object.values(bindings).includes(code))]
    : [primary]
}
export function loadKeys(saved) {
  const bindings = Object.fromEntries(Object.entries(defaultKeys).map(([action, code]) =>
    [action, typeof saved?.[action] === 'string' && bindable.test(saved[action]) ? saved[action] : code]))
  return new Set(Object.values(bindings)).size === Object.keys(defaultKeys).length ? bindings : { ...defaultKeys }
}
export function describeKey(code) {
  return ({ ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', Escape: 'Esc', ArrowUp: '↑',
    ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' })[code] ?? code.replace(/^(Key|Digit)/, '')
}
