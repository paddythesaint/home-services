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
const { onSchedule } = require("firebase-functions/v2/scheduler")
const { initializeApp } = require("firebase-admin/app")
const { getAuth } = require("firebase-admin/auth")
const { getFirestore } = require("firebase-admin/firestore")
const { extractTag, routeMessage, extractBody, parseActions, intakePrompt, todayLabel } = require("./gmail")

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
        hasGmail: Boolean(
          process.env.GMAIL_CLIENT_ID &&
            process.env.GMAIL_CLIENT_SECRET &&
            process.env.GMAIL_REFRESH_TOKEN
        ),
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

// ---------------------------------------------------------------------------
// Inbound email pipeline, phase 2: the Gmail poller. Every 10 minutes, read
// unread mail from the shared intake mailbox (cvillehomeservicestest@gmail.com
// — forwards from founders/clients land there, optionally tagged per home as
// cvillehomeservicestest+<tag>@gmail.com), route each message to a property,
// parse it with Claude into proposed records, and write an "email-intake"
// conversation whose PENDING actions surface in the app's Awaiting-
// confirmation queue (Slice 69) for a human to confirm. Nothing is ever
// auto-committed to the record.
//
// Credentials: an OAuth client + refresh token for the intake account only
// (scope gmail.modify — read + mark-as-read; it cannot send or delete).
// Written to functions/.env by CI from GitHub secrets, like the API key.
// Idempotency: processed Gmail message ids are recorded in the top-level
// `emailIngest` collection (admin-only), so a message is never double-parsed
// even if marking it read fails.

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

async function gmailAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

async function gmailGet(token, path) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Gmail GET ${path} failed: ${res.status}`)
  return res.json()
}

async function markRead(token, id) {
  await fetch(`${GMAIL_BASE}/messages/${id}/modify`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  })
}

async function parseWithClaude(apiKey, system, emailText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: emailText }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic parse failed: ${res.status}`)
  const data = await res.json()
  return (data.content || []).find((b) => b.type === "text")?.text || ""
}

exports.emailPoller = onSchedule(
  { schedule: "every 10 minutes", maxInstances: 1, memory: "256MiB", timeoutSeconds: 300 },
  async () => {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, ANTHROPIC_API_KEY } =
      process.env
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      console.log("emailPoller: Gmail credentials not configured — skipping run")
      return
    }
    if (!ANTHROPIC_API_KEY) {
      console.log("emailPoller: missing ANTHROPIC_API_KEY — skipping run")
      return
    }

    const db = getFirestore()
    const token = await gmailAccessToken()
    const list = await gmailGet(token, "/messages?q=in:inbox%20is:unread&maxResults=10")
    const ids = (list.messages || []).map((m) => m.id)
    if (ids.length === 0) return

    // The portfolio, once per run (small at this scale).
    const propsSnap = await db.collection("properties").get()
    const properties = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    for (const id of ids) {
      // Idempotency gate: claim the message id before doing any work.
      const gate = db.doc(`emailIngest/${id}`)
      if ((await gate.get()).exists) {
        await markRead(token, id)
        continue
      }
      await gate.set({ startedAt: new Date().toISOString(), status: "processing" })

      try {
        const msg = await gmailGet(token, `/messages/${id}?format=full`)
        const headers = msg.payload && msg.payload.headers
        const header = (name) =>
          (headers || []).find((h) => (h.name || "").toLowerCase() === name)?.value || ""
        const from = header("from")
        const subject = header("subject")
        const tag = extractTag(headers)
        const property = routeMessage(tag, properties)

        if (!property) {
          await gate.set({ status: "unrouted", from, subject, tag, at: new Date().toISOString() })
          await markRead(token, id)
          console.log(`emailPoller: unrouted message (tag "${tag}") — ${subject}`)
          continue
        }

        const body = extractBody(msg.payload).slice(0, 6000)
        const emailText = `From: ${from}\nSubject: ${subject}\n\n${body}`

        // Context for the parse: the property's open orders + systems.
        const [woSnap, sysSnap] = await Promise.all([
          db.collection(`properties/${property.id}/workOrders`).get(),
          db.collection(`properties/${property.id}/healthReport`).get(),
        ])
        const workOrders = woSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const systems = sysSnap.docs.map((d) => d.data())

        const raw = await parseWithClaude(
          ANTHROPIC_API_KEY,
          intakePrompt({ workOrders, systems }),
          emailText
        )
        const { text: replyText, actions } = parseActions(raw)

        // Same doc shape the app writes, so the Assistant Log and the
        // Awaiting-confirmation queue treat it like any other conversation.
        await db.collection(`properties/${property.id}/conversations`).add({
          startedBy: from,
          startedOn: todayLabel(),
          source: "email-intake",
          summary: `Email intake: ${(subject || body.split("\n")[0] || "message").slice(0, 60)}`,
          messages: [
            { role: "user", text: emailText.slice(0, 2000) },
            { role: "assistant", text: replyText, ...(actions.length ? { actions } : {}) },
          ],
          order: Date.now(),
        })

        await gate.set({
          status: "parsed",
          propertyId: property.id,
          from,
          subject,
          proposals: actions.length,
          at: new Date().toISOString(),
        })
        await markRead(token, id)
        console.log(`emailPoller: parsed "${subject}" → ${property.id} (${actions.length} proposals)`)
      } catch (err) {
        // Leave the gate in "processing" with the error; the message stays
        // unread so the NEXT run retries it once the gate is cleared — but
        // never loops: a stuck gate blocks re-processing until cleaned up.
        await gate.set({ status: "error", error: String(err), at: new Date().toISOString() })
        console.error(`emailPoller: failed on message ${id}:`, err)
      }
    }
  }
)
