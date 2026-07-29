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
const { getStorage } = require("firebase-admin/storage")
const { randomUUID } = require("crypto")
const {
  extractTag,
  routeMessage,
  extractBody,
  listAttachments,
  parseActions,
  partitionIntakeActions,
  intakePrompt,
  todayLabel,
} = require("./gmail")
const { buildBrief, normalizeForecast, rfc822 } = require("./brief")
const { recallMatches, scanBrands } = require("./recalls")
const { weatherNudges, pointFor } = require("./weather")
const { draftOutreach } = require("./outreach")
const { triageSystemPrompt, parseTriage, runTriage } = require("./tradeTriage")
const { FieldValue } = require("firebase-admin/firestore")

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
    // Web-search turns (outreach drafting) legitimately run past two
    // minutes — the searches happen inside the upstream request.
    timeoutSeconds: 300,
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

async function parseWithClaude(apiKey, system, emailText, imageBlocks = []) {
  const content = imageBlocks.length
    ? [...imageBlocks, { type: "text", text: emailText }]
    : emailText
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
      messages: [{ role: "user", content }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic parse failed: ${res.status}`)
  const data = await res.json()
  return (data.content || []).find((b) => b.type === "text")?.text || ""
}

// File a message's attachments to Storage + the property's documents
// collection — the same shape the app's uploadDocument writes, so they
// show up under Documents like any in-app upload. Returns what was filed,
// with image buffers kept so the parse can read nameplates off them.
// Per-attachment failures are logged and skipped; they never sink the email.
async function fileAttachments(db, token, messageId, propertyId, atts) {
  const filed = []
  const bucket = getStorage().bucket()
  for (const a of atts) {
    try {
      const data = await gmailGet(token, `/messages/${messageId}/attachments/${a.attachmentId}`)
      const buf = Buffer.from(
        (data.data || "").replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      )
      if (buf.length === 0 || buf.length > 10 * 1024 * 1024) continue
      const safeName = a.filename.replace(/[^\w.-]+/g, "_")
      const path = `properties/${propertyId}/documents/${Date.now()}-${safeName}`
      const dlToken = randomUUID()
      await bucket.file(path).save(buf, {
        contentType: a.mimeType,
        metadata: { metadata: { firebaseStorageDownloadTokens: dlToken } },
      })
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${dlToken}`
      await db.collection(`properties/${propertyId}/documents`).add({
        name: a.filename,
        path,
        url,
        size: buf.length,
        contentType: a.mimeType,
        uploadedBy: "email-intake",
        uploadedOn: new Date().toISOString().slice(0, 10),
      })
      filed.push({ ...a, buf })
    } catch (err) {
      console.error(`emailPoller: attachment "${a.filename}" failed to file:`, err)
    }
  }
  return filed
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
        const property = routeMessage(tag, properties, from)

        if (!property) {
          await gate.set({ status: "unrouted", from, subject, tag, at: new Date().toISOString() })
          await markRead(token, id)
          console.log(`emailPoller: unrouted message (tag "${tag}") — ${subject}`)
          continue
        }

        const body = extractBody(msg.payload).slice(0, 6000)

        // Attachments (nameplate photos, invoice PDFs) file to the home's
        // documents; the first couple of images also go to the parse so a
        // forwarded photo works with no body text at all.
        const filed = await fileAttachments(
          db,
          token,
          id,
          property.id,
          listAttachments(msg.payload)
        )
        const imageBlocks = filed
          .filter((a) => a.mimeType.startsWith("image/"))
          .slice(0, 2)
          .map((a) => ({
            type: "image",
            source: {
              type: "base64",
              media_type: a.mimeType,
              data: a.buf.toString("base64"),
            },
          }))
        const attachNote = filed.length
          ? `\n\n[${filed.length} attachment${filed.length === 1 ? "" : "s"} filed to the record: ${filed.map((a) => a.filename).join(", ")}]`
          : ""

        const emailText = `From: ${from}\nSubject: ${subject}\n\n${body || "(no body text — see attached photo)"}${attachNote}`

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
          emailText,
          imageBlocks
        )
        const { text: replyText, actions } = parseActions(raw)

        // Pure information files itself (founder call, 7/27): facts go
        // straight onto the record, stamped auto — the Home feed shows the
        // acknowledgment. Consequential actions still queue for a human.
        const { autoFile, confirm } = partitionIntakeActions(actions)
        for (const a of autoFile) {
          await db.collection(`properties/${property.id}/facts`).add({
            text: a.fact,
            category: a.category || "",
            source: "email-intake",
            confirmedBy: "auto (email intake)",
            date: todayLabel(),
            order: Date.now(),
          })
        }
        const stored = [...autoFile, ...confirm]

        // Same doc shape the app writes, so the Assistant Log and the
        // Awaiting-confirmation queue treat it like any other conversation.
        await db.collection(`properties/${property.id}/conversations`).add({
          startedBy: from,
          startedOn: todayLabel(),
          source: "email-intake",
          summary: `Email intake: ${(subject || body.split("\n")[0] || "message").slice(0, 60)}`,
          messages: [
            { role: "user", text: emailText.slice(0, 2000) },
            { role: "assistant", text: replyText, ...(stored.length ? { actions: stored } : {}) },
          ],
          order: Date.now(),
        })

        await gate.set({
          status: "parsed",
          propertyId: property.id,
          from,
          subject,
          proposals: confirm.length,
          autoFiled: autoFile.length,
          attachments: filed.length,
          at: new Date().toISOString(),
        })
        await markRead(token, id)
        console.log(
          `emailPoller: parsed "${subject}" → ${property.id} (${actions.length} proposals, ${filed.length} attachments)`
        )
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

// The weekly brief (redesigned 7/27): opens with the week's sky (10-day
// forecast scanned for actionable weather, seasonal beat otherwise), then
// done / owner-tagged what's-next / coming 30 days. Always sends — the
// Monday rhythm is the product. Each member gets their style: proactive
// (full brief, decision dollars) or passive (sky + done + reassurance),
// from profile.briefStyles[email] with staff defaulting proactive and
// everyone else passive. Every brief is stored on the property whether
// or not the send succeeds.
//
// Sending requires the Gmail token to carry the gmail.send scope — if
// sends log 403, re-mint the refresh token with that scope (RUNBOOK).
const BRIEF_FROM = "Charlottesville Home & Property Services <cvillehomeservicestest@gmail.com>"

// Staff read proactive unless the profile says otherwise.
const PROACTIVE_DEFAULT = new Set([...FOUNDER_EMAILS, "sallyrryan@gmail.com"])
const briefStyleFor = (profile, email) =>
  profile.briefStyles?.[email] ||
  (PROACTIVE_DEFAULT.has((email || "").toLowerCase()) ? "proactive" : "passive")

// 10-day forecast for the home's area (Open-Meteo — keyless, generous
// free tier); pointFor maps the ZIP like the weather nudges do. A fetch
// failure degrades to the seasonal line, never blocks the send.
async function fetchForecast(profile) {
  try {
    const [lat, lon] = pointFor(profile).split(",")
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max&forecast_days=10&timezone=America%2FNew_York&temperature_unit=fahrenheit`
    )
    if (!res.ok) return []
    return normalizeForecast(await res.json())
  } catch {
    return []
  }
}

exports.weeklyBrief = onSchedule(
  {
    schedule: "every monday 07:00",
    timeZone: "America/New_York",
    maxInstances: 1,
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env
    const canSend = Boolean(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN)

    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()

    for (const doc of propsSnap.docs) {
      const profile = doc.data()
      const members = profile.memberEmails || []
      if (members.length === 0) continue

      try {
        const [jobs, workOrders, calendar, systems] = await Promise.all(
          ["jobHistory", "workOrders", "careCalendar", "healthReport"].map(async (c) => {
            const snap = await db.collection(`properties/${doc.id}/${c}`).get()
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          })
        )

        const forecast = await fetchForecast(profile)

        // One compose per style actually in use; one send per style group.
        const groups = {}
        for (const m of members) {
          const style = briefStyleFor(profile, m)
          ;(groups[style] ||= []).push(m)
        }

        let status = "composed"
        let stored = null
        for (const [style, to] of Object.entries(groups)) {
          const brief = buildBrief({ profile, jobs, workOrders, calendar, systems, forecast, style })
          if (style === "proactive" || !stored) stored = brief

          if (!canSend) continue
          try {
            const token = await gmailAccessToken()
            const res = await fetch(`${GMAIL_BASE}/messages/send`, {
              method: "POST",
              headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                raw: rfc822({ from: BRIEF_FROM, to, ...brief }),
              }),
            })
            status = res.ok ? "sent" : `send-failed: ${res.status}`
            if (!res.ok)
              console.error(
                `weeklyBrief: ${style} send failed for ${doc.id} (${res.status}) — token may lack gmail.send scope`
              )
          } catch (err) {
            status = `send-failed: ${String(err)}`
            console.error(`weeklyBrief: ${style} send errored for ${doc.id}:`, err)
          }
        }

        await db.collection(`properties/${doc.id}/briefs`).add({
          subject: stored.subject,
          text: stored.text,
          sentTo: members,
          status,
          createdOn: todayLabel(),
          order: Date.now(),
        })
        console.log(`weeklyBrief: ${doc.id} → ${status} (${Object.keys(groups).join("+")})`)
      } catch (err) {
        console.error(`weeklyBrief: failed for ${doc.id}:`, err)
      }
    }
  }
)

// Weekly recall scan: check every registered brand against the CPSC
// SaferProducts API and file conservative matches (brand AND product
// context) as recallFindings on the property. The founder reviews them on
// the Command Center's Recall watch before anything reaches a homeowner.
// Findings are idempotent by {systemId}-{recallNumber}; a dismissal
// sticks — re-scans never resurrect it.
const CPSC_BASE = "https://www.saferproducts.gov/RestWebServices/Recall"

exports.recallScan = onSchedule(
  {
    schedule: "every wednesday 08:00",
    timeZone: "America/New_York",
    maxInstances: 1,
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()

    for (const doc of propsSnap.docs) {
      try {
        const sysSnap = await db.collection(`properties/${doc.id}/healthReport`).get()
        const systems = sysSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const brands = scanBrands(systems)
        if (brands.length === 0) continue

        const recalls = []
        for (const brand of brands) {
          try {
            const res = await fetch(
              `${CPSC_BASE}?format=json&RecallDateStart=2015-01-01&Manufacturer=${encodeURIComponent(brand)}`
            )
            if (!res.ok) {
              console.error(`recallScan: CPSC ${res.status} for brand "${brand}"`)
              continue
            }
            const data = await res.json()
            if (Array.isArray(data)) recalls.push(...data)
          } catch (err) {
            console.error(`recallScan: fetch failed for brand "${brand}":`, err)
          }
        }

        const findings = recallMatches(systems, recalls)
        let fresh = 0
        for (const f of findings) {
          const id = `${f.systemId}-${f.recallNumber}`.replace(/[^\w-]+/g, "_")
          const ref = db.doc(`properties/${doc.id}/recallFindings/${id}`)
          if ((await ref.get()).exists) continue // dismissals stick
          await ref.set({ ...f, status: "open", foundOn: todayLabel(), order: Date.now() })
          fresh += 1
        }
        console.log(
          `recallScan: ${doc.id} — ${brands.length} brands, ${findings.length} matches, ${fresh} new`
        )
      } catch (err) {
        console.error(`recallScan: failed for ${doc.id}:`, err)
      }
    }
  }
)


// Daily weather check (4pm ET — evening prep time): pull active NWS
// alerts for each home's area and turn the relevant ones into
// home-specific nudges, personalized by what the registry says the home
// has. Idempotent per NWS alert id; the app shows only unexpired nudges,
// so nothing needs cleanup.
exports.weatherCheck = onSchedule(
  {
    schedule: "every day 16:00",
    timeZone: "America/New_York",
    maxInstances: 1,
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()

    for (const doc of propsSnap.docs) {
      try {
        const profile = doc.data()
        const res = await fetch(
          `https://api.weather.gov/alerts/active?point=${pointFor(profile)}`,
          { headers: { "user-agent": "cville-home-services (paddythesaint@gmail.com)" } }
        )
        if (!res.ok) {
          console.error(`weatherCheck: NWS ${res.status} for ${doc.id}`)
          continue
        }
        const data = await res.json()
        const alerts = (data.features || []).map((f) => ({
          id: f.id || f.properties?.id || "",
          event: f.properties?.event || "",
          headline: f.properties?.headline || "",
          onset: f.properties?.onset || "",
          ends: f.properties?.ends || f.properties?.expires || "",
        }))

        const sysSnap = await db.collection(`properties/${doc.id}/healthReport`).get()
        const systems = sysSnap.docs.map((d) => d.data())
        const nudges = weatherNudges(alerts, systems)

        let fresh = 0
        for (const n of nudges) {
          const id = n.id.replace(/[^\w-]+/g, "_").slice(-120)
          const ref = db.doc(`properties/${doc.id}/nudges/${id}`)
          if ((await ref.get()).exists) continue
          await ref.set({ ...n, createdOn: todayLabel(), order: Date.now() })
          fresh += 1
        }
        if (nudges.length) console.log(`weatherCheck: ${doc.id} — ${nudges.length} active, ${fresh} new`)
      } catch (err) {
        console.error(`weatherCheck: failed for ${doc.id}:`, err)
      }
    }
  }
)

// ---------------------------------------------------------------------------
// Background outreach drafter. When someone taps "Draft the outreach", the
// app stakes a claim on the work order (outreachStatus "queued" + the full
// prompt) BEFORE calling the AI. If the phone finishes, it clears the
// claim; if the tab is closed, navigation kills the call, or the request
// times out, the claim survives — and this sweep finishes the job
// server-side so the draft is waiting on the record next visit.
// Idempotent: a completed draft clears the claim; errors leave it for the
// next run (capped per run to bound cost).
exports.outreachDrafter = onSchedule(
  { schedule: "every 10 minutes", maxInstances: 1, memory: "256MiB", timeoutSeconds: 540 },
  async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return

    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()
    let drafted = 0

    for (const doc of propsSnap.docs) {
      if (drafted >= 3) break // cost brake; the next run picks up the rest
      const queued = await db
        .collection(`properties/${doc.id}/workOrders`)
        .where("outreachStatus", "==", "queued")
        .get()

      for (const wo of queued.docs) {
        if (drafted >= 3) break
        const system = wo.get("outreachPrompt")
        if (!system) {
          // A claim with no prompt can't be drafted — clear it so the UI
          // returns to the Draft button instead of "researching" forever.
          await wo.ref.update({ outreachStatus: FieldValue.delete() })
          continue
        }
        try {
          const text = await draftOutreach({ apiKey, model: MODEL, maxTokens: MAX_TOKENS, system })
          await wo.ref.update({
            outreachDraft: text,
            outreachOn: todayLabel(),
            outreachStatus: FieldValue.delete(),
            outreachPrompt: FieldValue.delete(),
          })
          drafted += 1
          console.log(`outreachDrafter: ${doc.id}/${wo.id} drafted in background`)
        } catch (err) {
          console.error(`outreachDrafter: ${doc.id}/${wo.id} failed:`, err.message)
        }
      }
    }
  }
)

// ---------------------------------------------------------------------------
// Trade triage: the specialist read on every new intake order, run in
// parallel with the request — never as a gate in front of it. Every 10
// minutes, orders sitting in the triage lane without an assessment get
// one: trade classification, urgency (safety escalations included),
// material gaps, the questions a pro would ask, and constructability
// notes — written onto the order as `triage`, surfaced in the drawer and
// (for emergencies) the attention inbox. Checklists live in
// tradeTriage.js and are meant to be edited as HPS doctrine grows.
exports.tradeTriage = onSchedule(
  { schedule: "every 10 minutes", maxInstances: 1, memory: "256MiB", timeoutSeconds: 300 },
  async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return

    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()
    let assessed = 0

    for (const doc of propsSnap.docs) {
      if (assessed >= 4) break // cost brake; next run picks up the rest
      const pending = await db
        .collection(`properties/${doc.id}/workOrders`)
        .where("lane", "==", "triage")
        .get()
      const fresh = pending.docs.filter((d) => !d.get("triage"))
      if (fresh.length === 0) continue

      // The record context, once per property with work to assess.
      const [sysSnap, factsSnap] = await Promise.all([
        db.collection(`properties/${doc.id}/healthReport`).get(),
        db.collection(`properties/${doc.id}/facts`).get(),
      ])
      const systems = sysSnap.docs.map((d) => d.data())
      const facts = factsSnap.docs.map((d) => d.data())

      for (const wo of fresh) {
        if (assessed >= 4) break
        const order = { id: wo.id, ...wo.data() }
        try {
          const system = triageSystemPrompt({ order, systems, facts })
          const raw = await runTriage({ apiKey, model: MODEL, maxTokens: MAX_TOKENS, system })
          const t = parseTriage(raw)
          await wo.ref.update({
            triage: { ...t, on: todayLabel() },
          })
          assessed += 1
          console.log(`tradeTriage: ${doc.id}/${wo.id} → ${t.trade || "?"} / ${t.urgency || "?"}`)
        } catch (err) {
          console.error(`tradeTriage: ${doc.id}/${wo.id} failed:`, err.message)
        }
      }
    }
  }
)

// ---------------------------------------------------------------------------
// Onboarding sweep: a new property climbs the learning curve by itself.
// Daily, any member-holding property that's missing its baseline gets it:
// the starter care calendar (only while the calendar is empty), the
// hazard facts (flood zone via FEMA, radon zone by county — fixed ids,
// written once), and registry-aware care (a well on record adds the
// annual water test). Idempotent everywhere; failures retry next day.
const { STARTER_CALENDAR, radonZoneFact, floodZoneFact, wellTestTask } = require("./onboarding")

exports.onboardingSweep = onSchedule(
  { schedule: "every day 05:00", timeZone: "America/New_York", maxInstances: 1, memory: "256MiB", timeoutSeconds: 300 },
  async () => {
    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()

    for (const doc of propsSnap.docs) {
      const profile = doc.data()
      if ((profile.memberEmails || []).length === 0) continue
      try {
        const calSnap = await db.collection(`properties/${doc.id}/careCalendar`).get()
        const calendar = calSnap.docs.map((d) => d.data())

        // 1 · Starter calendar, once, while empty.
        if (calendar.length === 0) {
          for (const [i, t] of STARTER_CALENDAR.entries()) {
            await db.collection(`properties/${doc.id}/careCalendar`).add({
              ...t,
              source: "starter",
              order: Date.now() + i,
            })
          }
          console.log(`onboardingSweep: ${doc.id} — starter calendar seeded (${STARTER_CALENDAR.length})`)
        }

        // 2 · Hazard facts, fixed ids, written once each.
        const writeFact = async (f) => {
          if (!f) return false
          const ref = db.doc(`properties/${doc.id}/facts/${f.id}`)
          if ((await ref.get()).exists) return false
          await ref.set({
            text: f.text,
            category: f.category,
            source: "county records",
            confirmedBy: "auto (onboarding sweep)",
            date: todayLabel(),
            order: Date.now(),
          })
          return true
        }
        const [lat, lon] = pointFor(profile).split(",")
        const wroteFlood = await writeFact(
          (await db.doc(`properties/${doc.id}/facts/enrich-floodzone`).get()).exists
            ? null
            : await floodZoneFact(lat, lon)
        )
        const wroteRadon = await writeFact(radonZoneFact(profile))
        if (wroteFlood || wroteRadon)
          console.log(`onboardingSweep: ${doc.id} — hazard facts written (flood: ${wroteFlood}, radon: ${wroteRadon})`)

        // 3 · Registry-aware care.
        const sysSnap = await db.collection(`properties/${doc.id}/healthReport`).get()
        const systems = sysSnap.docs.map((d) => d.data())
        const task = wellTestTask(systems, calendar)
        if (task) {
          await db.collection(`properties/${doc.id}/careCalendar`).add({
            ...task,
            source: "registry",
            order: Date.now(),
          })
          console.log(`onboardingSweep: ${doc.id} — well water test added to the calendar`)
        }
      } catch (err) {
        console.error(`onboardingSweep: failed for ${doc.id}:`, err)
      }
    }
  }
)

// ---------------------------------------------------------------------------
// Founder daily digest + empty-record nudges (7/28). The digest mails the
// founder a plain-text "what changed on which home in the last 24h" every
// morning — visibility without logging in. The nudge emails a home's
// non-founder members when their record has sat empty for days (once a
// week at most), so a stalled onboarding restarts itself.
const { dailyDigest, emptyRecordReminder } = require("./digest")
const DIGEST_TO = ["paddythesaint@gmail.com"]

exports.founderDigest = onSchedule(
  { schedule: "every day 07:30", timeZone: "America/New_York", maxInstances: 1, memory: "256MiB", timeoutSeconds: 300 },
  async () => {
    const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env
    if (!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN)) return

    const db = getFirestore()
    const propsSnap = await db.collection("properties").get()
    const properties = []
    for (const doc of propsSnap.docs) {
      const collections = {}
      for (const c of ["facts", "jobHistory", "workOrders", "conversations", "photos", "healthReport"]) {
        const snap = await db.collection(`properties/${doc.id}/${c}`).get()
        collections[c] = snap.docs.map((d) => d.data())
      }
      properties.push({ profile: doc.data(), collections })
    }

    const digest = dailyDigest(properties)
    if (!digest) {
      console.log("founderDigest: quiet portfolio — nothing sent")
      return
    }
    try {
      const token = await gmailAccessToken()
      const res = await fetch(`${GMAIL_BASE}/messages/send`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ raw: rfc822({ from: BRIEF_FROM, to: DIGEST_TO, ...digest }) }),
      })
      console.log(`founderDigest: ${res.ok ? "sent" : `send failed ${res.status}`}`)
    } catch (err) {
      console.error("founderDigest: send errored:", err)
    }

    // Empty-record nudges ride the same morning run.
    for (const doc of propsSnap.docs) {
      try {
        const profile = doc.data()
        // Homes that predate the createdOnMs stamp get one now — the
        // clock starts today, so established homes are never nudged.
        if (!profile.createdOnMs) {
          await doc.ref.update({ createdOnMs: Date.now() })
          continue
        }
        const [sysSnap, jobsSnap] = await Promise.all([
          db.collection(`properties/${doc.id}/healthReport`).get(),
          db.collection(`properties/${doc.id}/jobHistory`).get(),
        ])
        const reminder = emptyRecordReminder({
          profile,
          systems: sysSnap.docs.map((d) => d.data()),
          jobs: jobsSnap.docs.map((d) => d.data()),
          founderEmails: FOUNDER_EMAILS,
        })
        if (!reminder) continue
        const token = await gmailAccessToken()
        const res = await fetch(`${GMAIL_BASE}/messages/send`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            raw: rfc822({ from: BRIEF_FROM, to: reminder.to, subject: reminder.subject, text: reminder.text }),
          }),
        })
        if (res.ok) await doc.ref.update({ reminderSentMs: Date.now() })
        console.log(`founderDigest: reminder for ${doc.id} — ${res.ok ? "sent" : `failed ${res.status}`}`)
      } catch (err) {
        console.error(`founderDigest: reminder failed for ${doc.id}:`, err)
      }
    }
  }
)
