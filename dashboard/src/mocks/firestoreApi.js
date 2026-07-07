// In-memory drop-in for firestoreApi.js, swapped in by the vite alias in
// mock/test mode (see vite.config.js). Same public API, backed by a mutable
// store seeded from fixtures. Subscriptions are live: mutations re-emit to
// every subscriber of the affected topic, so pages behave like they do
// against real Firestore snapshots.

import { fixtureData } from "./fixtures"

let store = structuredClone(fixtureData)
const listeners = new Map() // topic -> Set<fn>

function emit(topic, payload) {
  for (const fn of listeners.get(topic) || []) fn(payload)
}

function on(topic, fn) {
  if (!listeners.has(topic)) listeners.set(topic, new Set())
  listeners.get(topic).add(fn)
  return () => listeners.get(topic)?.delete(fn)
}

const prop = (uid) => store.properties[uid]
const coll = (uid, name) => {
  const p = prop(uid)
  if (!p.collections[name]) p.collections[name] = []
  return p.collections[name]
}

let nextId = 1
const genId = (prefix) => `${prefix}-${nextId++}`

// --- test helpers (not part of the real API) ---

export function __reset() {
  store = structuredClone(fixtureData)
  listeners.clear()
}

export function __getItems(uid, name) {
  return structuredClone(coll(uid, name))
}

export function __getProfile(uid) {
  return structuredClone(prop(uid).profile)
}

// --- real API surface ---

export async function resolvePropertyId(user) {
  for (const [id, p] of Object.entries(store.properties)) {
    if ((p.profile.memberEmails || []).includes(user.email)) return id
  }
  return null
}

export async function fetchMemberProperties(email) {
  return Object.entries(store.properties)
    .filter(([, p]) => (p.profile.memberEmails || []).includes(email))
    .map(([id, p]) => ({ id, ...structuredClone(p.profile) }))
}

export async function createProperty(data, user) {
  const email = (user.email || "").toLowerCase()
  const id = genId("prop")
  store.properties[id] = {
    profile: {
      ...data,
      members: [{ email, name: user.displayName || "", role: "owner" }],
      memberEmails: [email],
    },
    collections: {},
  }
  return id
}

export async function addMember(propertyId, { email, name, role }) {
  const profile = prop(propertyId).profile
  const members = profile.members || []
  const cleanEmail = email.trim().toLowerCase()
  if (members.some((m) => m.email === cleanEmail)) return
  profile.members = [...members, { email: cleanEmail, name: name || "", role: role || "owner" }]
  profile.memberEmails = profile.members.map((m) => m.email)
  emit(`prop:${propertyId}`, structuredClone(profile))
}

export async function removeMember(propertyId, email) {
  const profile = prop(propertyId).profile
  profile.members = (profile.members || []).filter((m) => m.email !== email)
  profile.memberEmails = profile.members.map((m) => m.email)
  emit(`prop:${propertyId}`, structuredClone(profile))
}

export function subscribeProperty(uid, callback) {
  const off = on(`prop:${uid}`, callback)
  callback(structuredClone(prop(uid)?.profile ?? null))
  return off
}

export function saveProperty(uid, data) {
  Object.assign(prop(uid).profile, data)
  emit(`prop:${uid}`, structuredClone(prop(uid).profile))
  return Promise.resolve()
}

function emitItems(uid, name) {
  const sorted = [...coll(uid, name)].sort((a, b) => (a.order || 0) - (b.order || 0))
  emit(`items:${uid}:${name}`, structuredClone(sorted))
  if (name === "photos" || name === "activity") {
    // Per-system topics re-derive from the full collection.
    for (const topic of listeners.keys()) {
      if (!topic.startsWith(`${name}:${uid}:`)) continue
      const systemId = topic.slice(`${name}:${uid}:`.length)
      emit(topic, filterSystem(uid, name, systemId))
    }
  }
}

function filterSystem(uid, name, systemId) {
  const entries = coll(uid, name).filter((d) => d.systemId === systemId)
  if (name === "activity") entries.sort((a, b) => (b.order || 0) - (a.order || 0))
  return structuredClone(entries)
}

// Simulate a permission denial for one collection (or the contractor
// network) to preview failure states: VITE_MOCK_DENY=jobHistory, etc.
const MOCK_DENY = import.meta.env?.VITE_MOCK_DENY || ""

const deniedError = () => {
  const err = new Error("Missing or insufficient permissions (mock)")
  err.code = "permission-denied"
  return err
}

export function subscribeItems(uid, name, callback, onError) {
  if (MOCK_DENY === name) {
    onError?.(deniedError())
    return () => {}
  }
  const off = on(`items:${uid}:${name}`, callback)
  callback(
    structuredClone([...coll(uid, name)].sort((a, b) => (a.order || 0) - (b.order || 0)))
  )
  return off
}

// Firestore rejects undefined field values outright ("Function addDoc()
// called with invalid data"). The mock mirrors that, deeply, so tests
// catch the bug class instead of shipping it.
function assertNoUndefined(value, path) {
  if (value === undefined) {
    throw new Error(
      `Function addDoc() called with invalid data. Unsupported field value: undefined (found in field ${path}) (mock)`
    )
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoUndefined(v, `${path}[${i}]`))
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoUndefined(v, `${path}.${k}`)
  }
}

export function addItem(uid, name, data) {
  assertNoUndefined(data, name)
  const item = { order: Date.now(), ...data, id: genId(name) }
  coll(uid, name).push(item)
  emitItems(uid, name)
  return Promise.resolve({ id: item.id })
}

export function updateItem(uid, name, id, data) {
  assertNoUndefined(data, name)
  const item = coll(uid, name).find((d) => d.id === id)
  if (item) Object.assign(item, data)
  emitItems(uid, name)
  return Promise.resolve()
}

export function removeItem(uid, name, id) {
  const list = coll(uid, name)
  const idx = list.findIndex((d) => d.id === id)
  if (idx >= 0) list.splice(idx, 1)
  emitItems(uid, name)
  return Promise.resolve()
}

export function subscribePhotos(uid, systemId, callback) {
  const off = on(`photos:${uid}:${systemId}`, callback)
  callback(filterSystem(uid, "photos", systemId))
  return off
}

function bumpPhotoCount(uid, systemId, delta) {
  const sys = coll(uid, "healthReport").find((s) => s.id === systemId)
  if (sys) {
    sys.photoCount = Math.max(0, (sys.photoCount || 0) + delta)
    emitItems(uid, "healthReport")
  }
}

export async function addPhoto(uid, data) {
  const ref = await addItem(uid, "photos", data)
  bumpPhotoCount(uid, data.systemId, 1)
  return ref
}

export function subscribeActivity(uid, systemId, callback) {
  const off = on(`activity:${uid}:${systemId}`, callback)
  callback(filterSystem(uid, "activity", systemId))
  return off
}

export function updatePhoto(uid, id, data) {
  return updateItem(uid, "photos", id, data)
}

export async function removePhoto(uid, id, systemId) {
  await removeItem(uid, "photos", id)
  bumpPhotoCount(uid, systemId, -1)
}

export async function fetchAllPhotos(uid) {
  return structuredClone(coll(uid, "photos"))
}

export function setPhotoCount(uid, systemId, count) {
  return updateItem(uid, "healthReport", systemId, { photoCount: count })
}

// Mirrors the real deleteSystemDeep: a deleted system takes its photos.
export async function deleteSystemDeep(uid, systemId) {
  const photos = coll(uid, "photos")
  const removed = photos.filter((p) => p.systemId === systemId).length
  prop(uid).collections.photos = photos.filter((p) => p.systemId !== systemId)
  emitItems(uid, "photos")
  await removeItem(uid, "healthReport", systemId)
  return removed
}

export function subscribeContractors(callback, onError) {
  if (MOCK_DENY === "contractors-network") {
    onError?.(deniedError())
    return () => {}
  }
  const off = on("contractors", callback)
  callback(structuredClone(store.contractors))
  return off
}

function emitContractors() {
  emit("contractors", structuredClone(store.contractors))
}

export function addContractor(data) {
  const item = { ...data, id: genId("net") }
  store.contractors.push(item)
  emitContractors()
  return Promise.resolve({ id: item.id })
}

export function updateContractor(id, data) {
  const item = store.contractors.find((c) => c.id === id)
  if (item) Object.assign(item, data)
  emitContractors()
  return Promise.resolve()
}

export function removeContractor(id) {
  store.contractors = store.contractors.filter((c) => c.id !== id)
  emitContractors()
  return Promise.resolve()
}

export async function fetchPropertyContractors(pid) {
  return structuredClone(coll(pid, "contractors"))
}

// Mirrors the real unifyRosters: network is truth; matching roster entries
// get networkId + refreshed contact fields, private ones are untouched.
export async function unifyRosters(email) {
  const byId = new Map(store.contractors.map((c) => [c.id, c]))
  const byName = new Map(
    store.contractors.map((c) => [(c.name || "").trim().toLowerCase(), c])
  )
  const properties = await fetchMemberProperties(email)
  let linked = 0
  let synced = 0
  const unmatched = []
  for (const p of properties) {
    for (const entry of coll(p.id, "contractors")) {
      const match =
        (entry.networkId && byId.get(entry.networkId)) ||
        byName.get((entry.name || "").trim().toLowerCase())
      if (!match) {
        unmatched.push(`${entry.name} (${p.address})`)
        continue
      }
      const patch = {
        networkId: match.id,
        name: match.name,
        trades: match.trades || "",
        phone: match.phone || "",
      }
      const changed =
        !entry.networkId ||
        ["name", "trades", "phone"].some((k) => (entry[k] || "") !== (patch[k] || ""))
      if (!changed) continue
      const wasLinked = Boolean(entry.networkId)
      Object.assign(entry, patch)
      emitItems(p.id, "contractors")
      if (wasLinked) synced += 1
      else linked += 1
    }
  }
  return { linked, synced, unmatched }
}

export async function seedCollections(uid, collections) {
  let order = Date.now()
  for (const [name, items] of Object.entries(collections)) {
    for (const item of items) {
      coll(uid, name).push({ ...item, order: order++, id: genId(name) })
    }
    emitItems(uid, name)
  }
}

export async function deletePropertyDeep(pid) {
  const p = store.properties[pid]
  if (!p) return 0
  const removed = Object.values(p.collections || {}).reduce((n, list) => n + list.length, 0)
  delete store.properties[pid]
  return removed
}

export async function scrubOrphanedApiKeys(email) {
  let count = 0
  for (const p of Object.values(store.properties)) {
    if ((p.profile.memberEmails || []).includes(email) && p.profile.anthropicApiKey) {
      delete p.profile.anthropicApiKey
      count++
    }
  }
  return count
}

// --- Founders' shared idea board ---

const ideasSorted = () =>
  structuredClone([...(store.ideas || [])].sort((a, b) => (b.order || 0) - (a.order || 0)))

export function subscribeIdeas(callback, onError) {
  if (MOCK_DENY === "ideas") {
    onError?.(deniedError())
    return () => {}
  }
  const off = on("ideas", callback)
  callback(ideasSorted())
  return off
}

export function addIdea(data) {
  if (!store.ideas) store.ideas = []
  const item = { ...data, id: genId("idea"), order: Date.now() }
  store.ideas.push(item)
  emit("ideas", ideasSorted())
  return Promise.resolve({ id: item.id })
}

export function updateIdea(id, data) {
  const item = (store.ideas || []).find((i) => i.id === id)
  if (item) Object.assign(item, data)
  emit("ideas", ideasSorted())
  return Promise.resolve()
}

export function removeIdea(id) {
  store.ideas = (store.ideas || []).filter((i) => i.id !== id)
  emit("ideas", ideasSorted())
  return Promise.resolve()
}

// --- Client relationship store (founder-only) ---

const clientEntry = (pid) => {
  if (!store.clients) store.clients = {}
  if (!store.clients[pid]) store.clients[pid] = { card: {}, touches: [] }
  return store.clients[pid]
}

export function subscribeClientCard(pid, callback, onError) {
  if (MOCK_DENY === "clients") {
    onError?.(deniedError())
    return () => {}
  }
  const off = on(`clients/${pid}`, callback)
  callback(structuredClone(clientEntry(pid).card))
  return off
}

export function saveClientCard(pid, data) {
  Object.assign(clientEntry(pid).card, data)
  emit(`clients/${pid}`, structuredClone(clientEntry(pid).card))
  return Promise.resolve()
}

export function addTouch(pid, data) {
  const entry = clientEntry(pid)
  const item = { ...data, id: genId("touch"), order: Date.now() }
  entry.touches.push(item)
  emit(`clients-touches/${pid}`, structuredClone(entry.touches.slice().reverse()))
  return Promise.resolve({ id: item.id })
}

export function subscribeTouches(pid, callback, onError) {
  if (MOCK_DENY === "clients") {
    onError?.(deniedError())
    return () => {}
  }
  const off = on(`clients-touches/${pid}`, callback)
  callback(structuredClone(clientEntry(pid).touches.slice().reverse()))
  return off
}

export async function fetchLatestTouch(pid) {
  const touches = clientEntry(pid).touches
  return touches.length ? structuredClone(touches[touches.length - 1]) : null
}

// Mirrors the real runDiagnostics shape. Everything passes unless
// VITE_MOCK_DENY names a collection, which fails its matching probe —
// handy for previewing the failure UI.
export async function runDiagnostics(user) {
  const properties = await fetchMemberProperties(user.email)
  const results = [
    {
      key: "membership",
      label: "Membership lookup",
      ok: true,
      detail: `${properties.length} properties visible`,
    },
    {
      key: "contractors-network",
      label: "Contractor network (founder-only collection)",
      ok: MOCK_DENY !== "contractors-network",
      detail:
        MOCK_DENY === "contractors-network"
          ? "permission-denied"
          : `${store.contractors.length} profiles readable`,
      fix:
        MOCK_DENY === "contractors-network"
          ? "The founder-only contractors rule isn't live — publish dashboard/firestore.rules."
          : undefined,
    },
  ]
  for (const name of [
    "healthReport",
    "careCalendar",
    "priorityList",
    "jobHistory",
    "workOrders",
    "photos",
    "activity",
    "contractors",
  ]) {
    const denied = MOCK_DENY === name
    results.push({
      key: `sub-${name}`,
      label: `Property data: ${name}`,
      ok: !denied,
      detail: denied ? "permission-denied" : "readable",
      fix: denied ? "Publish dashboard/firestore.rules in the Firebase console." : undefined,
    })
  }
  results.push({
    key: "ideas",
    label: "Idea board (founder-only)",
    ok: MOCK_DENY !== "ideas",
    detail: MOCK_DENY === "ideas" ? "permission-denied" : "readable",
    fix:
      MOCK_DENY === "ideas"
        ? "Publish dashboard/firestore.rules in the Firebase console."
        : undefined,
  })
  results.push({
    key: "clients",
    label: "Client relationship store (founder-only)",
    ok: MOCK_DENY !== "clients",
    detail: MOCK_DENY === "clients" ? "permission-denied" : "readable",
    fix:
      MOCK_DENY === "clients"
        ? "Publish dashboard/firestore.rules in the Firebase console."
        : undefined,
  })
  results.push({
    key: "backend",
    label: "Backend (AI proxy)",
    ok: MOCK_DENY !== "backend",
    detail: MOCK_DENY === "backend" ? "unreachable (mock)" : "reachable · key configured (mock)",
    fix:
      MOCK_DENY === "backend"
        ? "Check the 'Deploy backend functions' run under GitHub → Actions."
        : undefined,
  })
  return results
}

export function reorderItems(uid, name, itemA, itemB) {
  const list = coll(uid, name)
  const a = list.find((d) => d.id === itemA.id)
  const b = list.find((d) => d.id === itemB.id)
  if (a && b) {
    const tmp = a.order
    a.order = b.order
    b.order = tmp
  }
  emitItems(uid, name)
  return Promise.resolve()
}
