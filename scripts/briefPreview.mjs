// On-demand preview of the weekly brief: compose from live production
// data exactly as Monday's weeklyBrief will, and send it to the
// property's members with a "[Preview] " subject prefix. Run from the
// brief-preview workflow. Nothing is stored — this is a look, not the
// weekly record. Only send status reaches the (public) logs.

import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { buildBrief, rfc822 } = require("../functions/brief.js")

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

const FROM = "Charlottesville Home & Property Services <cvillehomeservicestest@gmail.com>"

async function gmailToken() {
  const body = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body })
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`)
  return (await res.json()).access_token
}

const props = await db.collection("properties").get()
for (const doc of props.docs) {
  const profile = doc.data()
  const members = profile.memberEmails || []
  if (members.length === 0) continue

  const [jobs, workOrders, calendar, systems] = await Promise.all(
    ["jobHistory", "workOrders", "careCalendar", "healthReport"].map(async (c) => {
      const snap = await db.collection(`properties/${doc.id}/${c}`).get()
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    })
  )

  const brief = buildBrief({ profile, jobs, workOrders, calendar, systems })
  if (!brief) {
    console.log(`preview: ${doc.id} — quiet week, nothing to compose`)
    continue
  }

  const token = await gmailToken()
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      raw: rfc822({ from: FROM, to: members, subject: `[Preview] ${brief.subject}`, text: brief.text }),
    }),
  })
  console.log(
    `preview: ${doc.id} — ${res.ok ? `SENT to ${members.length} member(s)` : `send failed: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`}`
  )
}
console.log("preview complete")
