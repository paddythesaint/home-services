import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  deleteField,
  increment,
} from "firebase/firestore"
import { db } from "./firebase"
import { callBackend } from "./backendApi"

// The `uid` parameter below is the property id. Historically it equalled the
// owner's Firebase uid; membership decouples the two. Resolve it once at load.
function propertyDocRef(uid) {
  return doc(db, "properties", uid)
}

// Find which property a signed-in user belongs to. Prefers membership (email
// in the property's memberEmails); falls back to the legacy uid-keyed doc and
// self-heals it by writing the owner's membership so future lookups use the
// membership path. Returns the property id, or null if the user has no access.
export async function resolvePropertyId(user) {
  // Membership lookup. If the rules don't permit this collection query yet
  // (e.g. the updated rules haven't been published), treat it as "no match"
  // and fall through to the legacy path rather than failing resolution — this
  // is what keeps the original owner from being locked out during the
  // rules transition.
  try {
    const found = await getDocs(
      query(
        collection(db, "properties"),
        where("memberEmails", "array-contains", user.email)
      )
    )
    if (!found.empty) return found.docs[0].id
  } catch (err) {
    console.warn("Membership lookup unavailable, trying legacy path:", err.code || err)
  }

  // Legacy uid-keyed doc: the original owner. Self-heal by writing membership
  // so subsequent lookups use the membership path.
  try {
    const legacy = await getDoc(propertyDocRef(user.uid))
    if (legacy.exists()) {
      const data = legacy.data()
      if (!data.memberEmails || !data.memberEmails.includes(user.email)) {
        await setDoc(
          propertyDocRef(user.uid),
          {
            memberEmails: [user.email],
            members: [
              { email: user.email, name: user.displayName || "", role: "owner" },
            ],
          },
          { merge: true }
        )
      }
      return user.uid
    }
  } catch (err) {
    console.warn("Legacy property lookup failed:", err.code || err)
  }
  return null
}

// Founder onboarding: create a property with the creator as first member.
// Requires the `allow create` clause in firestore.rules to be published
// (see RUNBOOK.md) — on permission-denied the UI says exactly that.
export async function createProperty(data, user) {
  const email = (user.email || "").toLowerCase()
  const ref = await addDoc(collection(db, "properties"), {
    ...data,
    members: [{ email, name: user.displayName || "", role: "owner" }],
    memberEmails: [email],
  })
  return ref.id
}

// All properties the user is a member of — the operator's portfolio. Scoped
// by membership, so an operator only ever sees properties they belong to.
export async function fetchMemberProperties(email) {
  const snap = await getDocs(
    query(collection(db, "properties"), where("memberEmails", "array-contains", email))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addMember(propertyId, { email, name, role }) {
  const snap = await getDoc(propertyDocRef(propertyId))
  const data = snap.data() || {}
  const members = data.members || []
  const cleanEmail = email.trim().toLowerCase()
  if (members.some((m) => m.email === cleanEmail)) return
  const nextMembers = [...members, { email: cleanEmail, name: name || "", role: role || "owner" }]
  await setDoc(
    propertyDocRef(propertyId),
    { members: nextMembers, memberEmails: nextMembers.map((m) => m.email) },
    { merge: true }
  )
}

export async function removeMember(propertyId, email) {
  const snap = await getDoc(propertyDocRef(propertyId))
  const data = snap.data() || {}
  const nextMembers = (data.members || []).filter((m) => m.email !== email)
  await setDoc(
    propertyDocRef(propertyId),
    { members: nextMembers, memberEmails: nextMembers.map((m) => m.email) },
    { merge: true }
  )
}

export function subscribeProperty(uid, callback) {
  return onSnapshot(propertyDocRef(uid), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export function saveProperty(uid, data) {
  return setDoc(propertyDocRef(uid), data, { merge: true })
}

function collectionRef(uid, name) {
  return collection(db, "properties", uid, name)
}

export function subscribeItems(uid, name, callback, onError) {
  const q = query(collectionRef(uid, name), orderBy("order"))
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    },
    (err) => {
      console.error(`subscribeItems(${name}) failed:`, err.code || err)
      onError?.(err)
    }
  )
}

export function addItem(uid, name, data) {
  return addDoc(collectionRef(uid, name), { ...data, order: Date.now() })
}

export function updateItem(uid, name, id, data) {
  return updateDoc(doc(db, "properties", uid, name, id), data)
}

export function removeItem(uid, name, id) {
  return deleteDoc(doc(db, "properties", uid, name, id))
}

// Photos live in their own collection (one doc per photo, keyed to a system)
// so system cards only load images when their photo section is opened.
export function subscribePhotos(uid, systemId, callback) {
  const q = query(collectionRef(uid, "photos"), where("systemId", "==", systemId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

// Photo writes keep a denormalized photoCount on the owning system so the
// Health Report can show "Photos (3)" without loading image docs. The
// count is cosmetic — failures to bump it never fail the photo write.
async function bumpPhotoCount(uid, systemId, delta) {
  if (!systemId) return
  try {
    await updateDoc(doc(db, "properties", uid, "healthReport", systemId), {
      photoCount: increment(delta),
    })
  } catch {
    /* system may have been deleted — the audit tool reconciles */
  }
}

export async function addPhoto(uid, data) {
  const ref = await addDoc(collectionRef(uid, "photos"), data)
  await bumpPhotoCount(uid, data.systemId, 1)
  return ref
}

// Per-system activity timeline (readings, actions, observations, service).
// Subscribed per system so cards only load their own history when opened.
export function subscribeActivity(uid, systemId, callback) {
  const q = query(collectionRef(uid, "activity"), where("systemId", "==", systemId))
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    entries.sort((a, b) => b.order - a.order)
    callback(entries)
  })
}

export function updatePhoto(uid, id, data) {
  return updateDoc(doc(db, "properties", uid, "photos", id), data)
}

export async function removePhoto(uid, id, systemId) {
  await deleteDoc(doc(db, "properties", uid, "photos", id))
  await bumpPhotoCount(uid, systemId, -1)
}

// Every photo on the property, for the audit tool: counts per system,
// orphans (photos whose system no longer exists), and count backfill.
export async function fetchAllPhotos(uid) {
  const snap = await getDocs(collectionRef(uid, "photos"))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function setPhotoCount(uid, systemId, count) {
  return updateDoc(doc(db, "properties", uid, "healthReport", systemId), {
    photoCount: count,
  })
}

// Deleting a system takes its photos with it — otherwise they linger as
// orphans only the founder's audit tool can find. Returns how many photos
// went with the system.
export async function deleteSystemDeep(uid, systemId) {
  const snap = await getDocs(collectionRef(uid, "photos"))
  const mine = snap.docs.filter((d) => d.data().systemId === systemId)
  for (const d of mine) {
    await deleteDoc(d.ref)
  }
  await deleteDoc(doc(db, "properties", uid, "healthReport", systemId))
  return mine.length
}

// Business-plane contractor network: a top-level collection, one profile
// per contractor across all properties. Founder-only via firestore.rules
// isFounder — a denied subscription surfaces through onError.
export function subscribeContractors(callback, onError) {
  return onSnapshot(
    collection(db, "contractors"),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export function addContractor(data) {
  return addDoc(collection(db, "contractors"), data)
}

export function updateContractor(id, data) {
  return updateDoc(doc(db, "contractors", id), data)
}

export function removeContractor(id) {
  return deleteDoc(doc(db, "contractors", id))
}

// The founders' shared idea board (top-level, founder-only via rules).
export function subscribeIdeas(callback, onError) {
  return onSnapshot(
    query(collection(db, "ideas"), orderBy("order", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export function addIdea(data) {
  return addDoc(collection(db, "ideas"), { ...data, order: Date.now() })
}

export function updateIdea(id, data) {
  return updateDoc(doc(db, "ideas", id), data)
}

export function removeIdea(id) {
  return deleteDoc(doc(db, "ideas", id))
}

// One-time migration source: the per-property rosters from slice 3.
export async function fetchPropertyContractors(pid) {
  const snap = await getDocs(collection(db, "properties", pid, "contractors"))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Roster unification: the network is the source of truth for shared
// vendors. Every roster entry that matches a network profile (by stored
// networkId, or by name on first pass) is stamped with the profile's id
// and has its contact fields (name / trades / phone) refreshed from it.
// Entries with no match are the homeowner's own private vendors — left
// untouched, and never pushed into the business collection from here.
// Founder-only in practice: it reads the founder-gated network and walks
// every property they're a member of.
export async function unifyRosters(email) {
  const netSnap = await getDocs(collection(db, "contractors"))
  const network = netSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const byId = new Map(network.map((c) => [c.id, c]))
  const byName = new Map(network.map((c) => [(c.name || "").trim().toLowerCase(), c]))

  const properties = await fetchMemberProperties(email)
  let linked = 0
  let synced = 0
  const unmatched = []
  for (const p of properties) {
    const roster = await fetchPropertyContractors(p.id)
    for (const entry of roster) {
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
      await updateItem(p.id, "contractors", entry.id, patch)
      if (entry.networkId) synced += 1
      else linked += 1
    }
  }
  return { linked, synced, unmatched }
}

export async function seedCollections(uid, collections) {
  // Explicit incrementing order values — Date.now() would collide within a batch.
  let order = Date.now()
  for (const [name, items] of Object.entries(collections)) {
    for (const item of items) {
      await addDoc(collectionRef(uid, name), { ...item, order: order++ })
    }
  }
}

export function reorderItems(uid, name, itemA, itemB) {
  return Promise.all([
    updateDoc(doc(db, "properties", uid, name, itemA.id), { order: itemB.order }),
    updateDoc(doc(db, "properties", uid, name, itemB.id), { order: itemA.order }),
  ])
}

// Founder admin: permanently delete a property. Firestore does NOT
// cascade-delete subcollections when a doc is removed, so every known
// subcollection is emptied first. Membership write permission covers all
// of it — the founder is a member of anything they created. Returns how
// many subcollection docs were removed.
export async function deletePropertyDeep(pid) {
  let removed = 0
  for (const name of PROBE_SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, "properties", pid, name))
    for (const d of snap.docs) {
      await deleteDoc(d.ref)
      removed++
    }
  }
  await deleteDoc(propertyDocRef(pid))
  return removed
}

// Slice 10 removed the client-side AI features but left the pasted
// Anthropic API key sitting in property profiles. One-time hygiene action
// from the System status panel: deletes the field on every property the
// caller can see. Returns how many keys were removed.
export async function scrubOrphanedApiKeys(email) {
  const properties = await fetchMemberProperties(email)
  const holders = properties.filter((p) => p.anthropicApiKey)
  for (const p of holders) {
    await updateDoc(propertyDocRef(p.id), { anthropicApiKey: deleteField() })
  }
  return holders.length
}

// --- Client relationship store (founder-only; see firestore.rules) ---
// What the business remembers about the relationship: household
// preferences, access notes, key dates, and a touch log. Lives in its own
// top-level collection (clients/{propertyId}) so members can never read
// it — this is ours, not the property record's.

export function subscribeClientCard(pid, callback, onError) {
  return onSnapshot(
    doc(db, "clients", pid),
    (snap) => callback(snap.exists() ? snap.data() : {}),
    onError
  )
}

export function saveClientCard(pid, data) {
  return setDoc(doc(db, "clients", pid), data, { merge: true })
}

export function addTouch(pid, data) {
  return addDoc(collection(db, "clients", pid, "touches"), {
    ...data,
    order: Date.now(),
  })
}

export function subscribeTouches(pid, callback, onError) {
  return onSnapshot(
    query(collection(db, "clients", pid, "touches"), orderBy("order", "desc")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function fetchLatestTouch(pid) {
  const snap = await getDocs(
    query(collection(db, "clients", pid, "touches"), orderBy("order", "desc"), limit(1))
  )
  return snap.docs.length ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null
}

// Live permission probes for the founder-only System status panel. Rules are
// published by hand in the Firebase console and can drift from the repo's
// firestore.rules — these cheap, read-only checks tell you which capabilities
// are actually live in production. Nothing here writes or creates data.
const PROBE_SUBCOLLECTIONS = [
  "healthReport",
  "careCalendar",
  "priorityList",
  "jobHistory",
  "workOrders",
  "photos",
  "activity",
  "contractors",
]

const RULES_FIX =
  "The published Firestore rules are behind the repo — publish dashboard/firestore.rules " +
  "in the Firebase console (Firestore Database → Rules), then re-run these checks."

export async function runDiagnostics(user) {
  const results = []
  const add = (key, label, ok, detail, fix) => results.push({ key, label, ok, detail, fix })

  let properties = []
  try {
    properties = await fetchMemberProperties(user.email)
    add(
      "membership",
      "Membership lookup",
      true,
      `${properties.length} propert${properties.length === 1 ? "y" : "ies"} visible`
    )
  } catch (err) {
    add("membership", "Membership lookup", false, err.code || String(err), RULES_FIX)
  }

  try {
    const snap = await getDocs(collection(db, "contractors"))
    add(
      "contractors-network",
      "Contractor network (founder-only collection)",
      true,
      `${snap.size} profile${snap.size === 1 ? "" : "s"} readable`
    )
  } catch (err) {
    add(
      "contractors-network",
      "Contractor network (founder-only collection)",
      false,
      err.code || String(err),
      "The founder-only contractors rule isn't live — the Contractor Network page and the " +
        "Job History contractor picker are broken in production until it is. " +
        RULES_FIX
    )
  }

  const pid = properties[0]?.id
  if (pid) {
    for (const name of PROBE_SUBCOLLECTIONS) {
      try {
        await getDocs(query(collection(db, "properties", pid, name), limit(1)))
        add(`sub-${name}`, `Property data: ${name}`, true, "readable")
      } catch (err) {
        add(`sub-${name}`, `Property data: ${name}`, false, err.code || String(err), RULES_FIX)
      }
    }
    try {
      await getDocs(query(collection(db, "ideas"), limit(1)))
      add("ideas", "Idea board (founder-only)", true, "readable")
    } catch (err) {
      add(
        "ideas",
        "Idea board (founder-only)",
        false,
        err.code || String(err),
        "The founder-only ideas rule isn't live. " + RULES_FIX
      )
    }
    try {
      await getDoc(doc(db, "clients", pid))
      add("clients", "Client relationship store (founder-only)", true, "readable")
    } catch (err) {
      add(
        "clients",
        "Client relationship store (founder-only)",
        false,
        err.code || String(err),
        "The clients/{propertyId} rule isn't live — the relationship card and touch log " +
          "can't load or save until it is. " +
          RULES_FIX
      )
    }
  } else {
    add(
      "sub-none",
      "Property data",
      false,
      "no property visible to probe",
      "Membership lookup returned nothing — fix that first."
    )
  }

  // Backend liveness: verifies the Cloud Function is deployed, reachable,
  // accepting our sign-in tokens, and holding its server-side API key.
  try {
    const data = await callBackend("ping")
    add(
      "backend",
      "Backend (AI proxy)",
      Boolean(data.ok && data.hasKey),
      data.hasKey ? "reachable · key configured server-side" : "reachable but ANTHROPIC_API_KEY is missing",
      data.hasKey
        ? undefined
        : "The deploy ran without the ANTHROPIC_API_KEY GitHub secret — set it and re-run the deploy-functions workflow."
    )
  } catch (err) {
    add(
      "backend",
      "Backend (AI proxy)",
      false,
      err.message || String(err),
      "The backend isn't deployed or reachable. Check the 'Deploy backend functions' run under GitHub → Actions; merging to main (or Run workflow) triggers it."
    )
  }

  return results
}
