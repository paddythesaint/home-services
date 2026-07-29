// Founder visibility without logging in (7/28): two pure composers.
//
//   1. dailyDigest — a plain-text morning note to the founder listing
//      what changed on each home in the last day (facts filed, jobs,
//      orders, conversations, photos). Quiet portfolio → null, no email.
//   2. emptyRecordReminder — the gentle nudge: a home invited days ago
//      whose record is still empty gets a friendly "your record is
//      waiting" email, at most once a week.
//
// The scheduled senders live in index.js.

const DAY = 86_400_000

// Items added since the cutoff, judged by the numeric `order` stamp the
// app writes on creation (Date.now()). Items without one don't count —
// better to under-report than misdate.
const recent = (items = [], sinceMs) =>
  items.filter((it) => typeof it.order === "number" && it.order >= sinceMs)

const label = (it) => it.title || it.text || it.task || it.summary || it.name || "(untitled)"

// One property's section of the digest, or null when nothing happened.
function propertyDigest({ profile = {}, collections = {} }, sinceMs) {
  const parts = []
  const show = (name, items, cap = 5) => {
    const fresh = recent(items, sinceMs)
    if (fresh.length === 0) return
    const titles = fresh.slice(0, cap).map((it) => `    - ${label(it).slice(0, 90)}`)
    const more = fresh.length > cap ? `    …and ${fresh.length - cap} more` : ""
    parts.push(`  ${name} (${fresh.length}):\n${titles.join("\n")}${more ? `\n${more}` : ""}`)
  }
  show("Facts filed", collections.facts)
  show("Jobs", collections.jobHistory)
  show("Work orders", collections.workOrders)
  show("Conversations", collections.conversations, 3)
  show("Photos", collections.photos, 3)
  show("Systems added", collections.healthReport)
  if (parts.length === 0) return null
  return `${profile.address || "(unnamed home)"}\n${parts.join("\n")}`
}

function dailyDigest(properties = [], { now = new Date(), windowMs = DAY } = {}) {
  const sinceMs = now.getTime() - windowMs
  const sections = properties
    .map((p) => propertyDigest(p, sinceMs))
    .filter(Boolean)
  if (sections.length === 0) return null
  const text = `Portfolio activity — last 24 hours

${sections.join("\n\n")}

(Automatic founder digest; reply STOP-DIGEST and Patrick's assistant will turn it off.)
`
  return {
    subject: `Portfolio digest — ${sections.length} home${sections.length === 1 ? "" : "s"} with activity`,
    text,
  }
}

// The empty-record nudge. Fires only when ALL of:
//   - the home is old enough (>= minAgeDays since createdOnMs),
//   - the record is still effectively empty (no systems, no jobs),
//   - we haven't reminded within the cooldown.
// Returns the email to send (to non-founder members) or null.
function emptyRecordReminder(
  { profile = {}, systems = [], jobs = [], founderEmails = [] },
  { now = new Date(), minAgeDays = 5, cooldownDays = 7 } = {}
) {
  const created = profile.createdOnMs
  if (!created) return null
  if (now.getTime() - created < minAgeDays * DAY) return null
  if (systems.length > 0 || jobs.length > 0) return null
  const last = profile.reminderSentMs || 0
  if (now.getTime() - last < cooldownDays * DAY) return null

  const to = (profile.memberEmails || []).filter(
    (e) => !founderEmails.includes((e || "").toLowerCase())
  )
  if (to.length === 0) return null

  return {
    to,
    subject: `Your home record is ready when you are — ${profile.address || "your home"}`,
    text: `Hi,

Your home's record at ${profile.address || "your address"} is set up and waiting — it just doesn't know anything yet.

The fastest way in: open the app on your phone and start the Walkthrough. Ten minutes and a few nameplate photos gets you a working systems list, and everything else (care calendar, weekly notes, project tracking) builds itself from there.

Or simply email photos and documents to cvillehomeservicestest@gmail.com — they file themselves.

Questions? Just reply — we see it right away.
— Your team at Charlottesville Home & Property Services
`,
  }
}

module.exports = { dailyDigest, emptyRecordReminder }
