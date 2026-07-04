// Client for the Cloud Functions backend. Every call carries the signed-in
// user's Firebase ID token; the server verifies it and checks property
// membership before doing anything. The Anthropic key lives only on the
// server — this module never sees a secret.

import { auth } from "./firebase"

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
export const BACKEND_URL = projectId
  ? `https://us-central1-${projectId}.cloudfunctions.net/api`
  : ""

export async function callBackend(action, extra = {}) {
  const user = auth.currentUser
  if (!user) throw new Error("Not signed in")
  if (!BACKEND_URL) throw new Error("Backend URL not configured")
  const token = await user.getIdToken()
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Backend error ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

// The AI entry point features will use: server enforces model, token cap,
// auth, and membership. Mirrors the old callClaude() shape.
export function callClaude(propertyId, system, messages, tools) {
  return callBackend("claude", { propertyId, payload: { system, messages, tools } })
}
