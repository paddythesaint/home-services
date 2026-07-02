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
} from "firebase/firestore"
import { db } from "./firebase"

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

export function subscribeItems(uid, name, callback) {
  const q = query(collectionRef(uid, name), orderBy("order"))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
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

export function addPhoto(uid, data) {
  return addDoc(collectionRef(uid, "photos"), data)
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

export function removePhoto(uid, id) {
  return deleteDoc(doc(db, "properties", uid, "photos", id))
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
