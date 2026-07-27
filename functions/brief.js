// The weekly brief — the record working for the homeowner without anyone
// opening the app. Pure composition over the property's subcollections so
// it can be unit-tested without Firebase; the scheduled sender lives in
// index.js. A quiet week produces null: no email beats an empty email.

// Millis from the app's human date labels ("July 12, 2026"); NaN-safe.
const when = (label) => Date.parse(label || "")

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function section(title, lines) {
  if (!lines.length) return ""
  return `${title.toUpperCase()}\n${lines.map((l) => `  • ${l}`).join("\n")}\n`
}

function buildBrief({ profile = {}, jobs = [], workOrders = [], calendar = [], systems = [], now = new Date() }) {
  const weekAgo = now.getTime() - 7 * 86_400_000
  const todayIso = now.toISOString().slice(0, 10)
  const month = MONTHS[now.getMonth()]

  // Handled: completed work in the last seven days.
  const handled = jobs
    .filter((j) => (j.status || "completed") === "completed")
    .filter((j) => {
      const t = when(j.date)
      return !Number.isNaN(t) && t >= weekAgo && t <= now.getTime()
    })
    .map((j) => `${j.title}${j.sub ? ` — ${j.sub}` : ""}${j.date ? ` (${j.date})` : ""}`)

  // Coming up: work on the calendar, plus this month's care not yet done.
  const scheduled = workOrders
    .filter((w) => w.lane === "scheduled" || w.lane === "in-progress")
    .map(
      (w) =>
        `${w.title}${w.contractorName ? ` — ${w.contractorName}` : ""}${w.scheduledFor ? ` (${w.scheduledFor})` : w.lane === "in-progress" ? " (in progress)" : ""}`
    )
  const careDue = calendar
    .filter((t) => t.month === month && t.doneYear !== now.getFullYear())
    .map((t) => `${t.task} — on this month's care plan`)

  // Needs your eye: quotes sitting in, and checks past due.
  const quotesIn = workOrders
    .filter((w) => w.lane !== "done" && w.lane !== "canceled" && w.quoteStatus === "received")
    .map((w) => `Quote in for "${w.title}"${w.quoteAmount ? ` — ${w.quoteAmount}` : ""}`)
  const checksDue = systems
    .filter((s) => s.nextDue && s.nextDue <= todayIso)
    .map((s) => `${s.category} — recurring check due`)

  // Parked check-ins: revisit dates that have arrived.
  const parkedDue = workOrders
    .filter((w) => w.lane === "parked" && w.revisitOn && w.revisitOn <= todayIso)
    .map((w) => `"${w.title}" — you asked us to check back${w.waitingOn ? ` (was waiting on ${w.waitingOn})` : ""}`)

  const body =
    section("Handled this week", handled) +
    section("Coming up", [...scheduled, ...careDue]) +
    section("Needs your eye", [...quotesIn, ...checksDue]) +
    section("Parked — ready to revisit?", parkedDue)

  if (!body) return null

  const text = `Your home this week — ${profile.address || "your home"}

${body}
Reply to this email or write in the app — we see it right away.
— ${profile.teamSignature || "Your team at Charlottesville Home & Property Services"}
`
  return {
    subject: `Your home this week — ${profile.address || ""}`.trim(),
    text,
  }
}

// Non-ASCII header values (the em-dash in every subject) must be RFC
// 2047-encoded or mail clients read the UTF-8 bytes as Latin-1 and
// render mojibake ("Ã¢Â€Â"" where "—" should be).
const encodeHeader = (s) =>
  /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`

// The RFC-822 message Gmail's send endpoint wants, base64url-encoded.
function rfc822({ from, to, subject, text }) {
  const msg = [
    "MIME-Version: 1.0",
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${encodeHeader(subject)}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
  ].join("\r\n")
  return Buffer.from(msg).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

module.exports = { buildBrief, rfc822 }
