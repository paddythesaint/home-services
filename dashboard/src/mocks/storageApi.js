// In-memory stand-in for storageApi.js (aliased in mock/test mode):
// no bucket, but the same metadata contract — uploads land in the mock
// property's `documents` collection with a fake URL.

import { addItem } from "./firestoreApi"

export const MAX_DOC_BYTES = 10 * 1024 * 1024

export async function uploadDocument(pid, file, uploadedBy) {
  if (file.size > MAX_DOC_BYTES) {
    throw new Error("That file is over 10MB — email it to the team instead.")
  }
  const path = `properties/${pid}/documents/${Date.now()}-${file.name}`
  const meta = {
    name: file.name,
    path,
    url: `mock://storage/${path}`,
    size: file.size,
    contentType: file.type,
    uploadedBy: uploadedBy || "",
    uploadedOn: new Date().toISOString().slice(0, 10),
  }
  const docRef = await addItem(pid, "documents", meta)
  return { id: docRef.id, ...meta }
}
