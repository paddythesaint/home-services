import {
  doc,
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

function propertyDocRef(uid) {
  return doc(db, "properties", uid)
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
