// Global bus for data-layer failures. Any subscription that errors (most
// commonly permission-denied, when the published Firestore rules are behind
// the repo) reports here, and Layout renders a visible banner — a permission
// failure must never look like an empty page.

const listeners = new Set()
let errors = {} // key -> { collection, code }

function emit() {
  for (const fn of listeners) fn(errors)
}

export function reportDataError(key, info) {
  if (errors[key]?.code === info.code) return
  errors = { ...errors, [key]: info }
  emit()
}

export function clearDataError(key) {
  if (!(key in errors)) return
  const next = { ...errors }
  delete next[key]
  errors = next
  emit()
}

export function subscribeDataErrors(fn) {
  listeners.add(fn)
  fn(errors)
  return () => listeners.delete(fn)
}

// Test helper.
export function __resetDataErrors() {
  errors = {}
  listeners.clear()
}
