// Cloud Storage for the property's documents (manuals, invoices, closing
// packages). Files live under properties/{pid}/documents/… — access is
// member-gated by storage.rules (cross-service check against the property's
// memberEmails, mirroring Firestore). Metadata rides in the property's
// `documents` subcollection so lists and links come from Firestore like
// everything else.

import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "./firebase"
import { addItem } from "./firestoreApi"

export const MAX_DOC_BYTES = 10 * 1024 * 1024 // keep uploads phone-friendly

export async function uploadDocument(pid, file, uploadedBy) {
  if (file.size > MAX_DOC_BYTES) {
    throw new Error("That file is over 10MB — email it to the team instead.")
  }
  const path = `properties/${pid}/documents/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  const url = await getDownloadURL(storageRef)
  const meta = {
    name: file.name,
    path,
    url,
    size: file.size,
    contentType: file.type,
    uploadedBy: uploadedBy || "",
    uploadedOn: new Date().toISOString().slice(0, 10),
  }
  const docRef = await addItem(pid, "documents", meta)
  return { id: docRef.id, ...meta }
}
