// The backend: a single HTTPS function that holds the Anthropic API key
// server-side and only talks to callers who prove who they are. This is
// the piece whose absence forced the client-side AI features out in
// Slice 10 — with it, they can come back safely.
//
// Security model, in order:
//   1. Caller must present a valid Firebase ID token (signed-in Google user).
//   2. "claude" calls must be a founder OR a member of the property they're
//      asking about (memberEmails on the property doc — same source of
//      truth as firestore.rules).
//   3. The API key comes from functions/.env, written by CI from a GitHub
//      secret at deploy time. It never exists in the browser bundle.
//   4. maxInstances caps the blast radius of any bug or abuse — this is
//      the hard cost protection; the billing budget only alerts.

const { onRequest } = require("firebase-functions/v2/https")
const { initializeApp } = require("firebase-admin/app")
const { getAuth } = require("firebase-admin/auth")
const { getFirestore } = require("firebase-admin/firestore")

initializeApp()

// Keep in sync with dashboard/src/founders.js and firestore.rules.
const FOUNDER_EMAILS = ["paddythesaint@gmail.com", "michael.e.sutton@gmail.com"]

const ALLOWED_ORIGINS = [
  "https://paddythesaint.github.io",
  "http://localhost:4173",
  "http://localhost:5173",
]

// The model and output cap are fixed server-side — clients ask for work,
// not for spend parameters. The cap is sized to the biggest legitimate
// reply (a document summary plus five proposed facts); anything needing
// more output than this is not a home-services conversation.
const MODEL = "claude-sonnet-5"
const MAX_TOKENS = 4096

// Light per-instance rate limit (per user, per hour). Honest limitation:
// it's per warm instance, so the true ceiling is LIMIT × maxInstances —
// good enough as an abuse brake at this scale.
const LIMIT_PER_HOUR = 60
const usage = new Map()
function overLimit(uid) {
  const now = Date.now()
  const entry = usage.get(uid)
  if (!entry || now > entry.resetAt) {
    usage.set(uid, { count: 1, resetAt: now + 3600_000 })
    return false
  }
  entry.count += 1
  return entry.count > LIMIT_PER_HOUR
}

async function isMemberOf(propertyId, email) {
  if (!propertyId) return false
  const snap = await getFirestore().doc(`properties/${propertyId}`).get()
  if (!snap.exists) return false
  const emails = snap.get("memberEmails") || []
  return emails.includes(email)
}

exports.api = onRequest(
  {
    maxInstances: 2,
    memory: "256MiB",
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST only" })
      return
    }

    // 1. Who is calling?
    const header = req.get("authorization") || ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : null
    if (!token) {
      res.status(401).json({ error: "Missing sign-in token" })
      return
    }
    let caller
    try {
      caller = await getAuth().verifyIdToken(token)
    } catch {
      res.status(401).json({ error: "Invalid or expired sign-in token" })
      return
    }
    const email = (caller.email || "").toLowerCase()
    if (!caller.email_verified) {
      res.status(403).json({ error: "Email not verified" })
      return
    }

    const { action, propertyId, payload } = req.body || {}
    const founder = FOUNDER_EMAILS.includes(email)

    // 2. Cheap liveness/config probe for the System status panel.
    if (action === "ping") {
      res.json({
        ok: true,
        hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
        at: new Date().toISOString(),
      })
      return
    }

    if (action !== "claude") {
      res.status(400).json({ error: `Unknown action "${action}"` })
      return
    }

    // 3. Authorization: founders anywhere, members on their own property.
    if (!founder && !(await isMemberOf(propertyId, email))) {
      res.status(403).json({ error: "Not a member of this property" })
      return
    }
    if (overLimit(caller.uid)) {
      res.status(429).json({ error: "Rate limit reached — try again in an hour" })
      return
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: "Server is missing its ANTHROPIC_API_KEY" })
      return
    }

    // 4. Forward to Anthropic. Only the conversational surface is caller-
    //    controlled; model and cap are ours.
    const { system, messages, tools } = payload || {}
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "payload.messages is required" })
      return
    }
    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          ...(system ? { system } : {}),
          messages,
          ...(tools ? { tools } : {}),
        }),
      })
      const data = await upstream.json()
      res.status(upstream.ok ? 200 : upstream.status).json(data)
    } catch (err) {
      console.error("Anthropic call failed:", err)
      res.status(502).json({ error: "Upstream AI request failed" })
    }
  }
)
