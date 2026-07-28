// The weekly brief, redesigned (founder spec, 7/27): every Monday opens
// with the week's sky — the 10-day forecast scanned for anything a
// homeowner should act on, falling back to the seasonal beat — then
// done / what's next (owner-tagged: YOU · US · VENDOR) / coming ~30
// days. Always sends: a quiet week leads with "all quiet, nothing
// needed from you," because the rhythm itself is the product.
//
// Two reader styles, founder-set per member (profile.briefStyles map;
// staff default proactive, clients passive):
//   proactive — the full brief, dollar amounts on decisions.
//   passive   — sky + done + one reassurance line; no dollars, no list.
//
// Pure composition over the property's records + a normalized forecast;
// the scheduled sender and the forecast fetch live in index.js.

const when = (label) => Date.parse(label || "")

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// --- The sky line ---------------------------------------------------------

// Normalize Open-Meteo's daily arrays into one row per day.
function normalizeForecast(om) {
  const d = om?.daily
  if (!d?.time?.length) return []
  return d.time.map((date, i) => ({
    date,
    max: d.temperature_2m_max?.[i],
    min: d.temperature_2m_min?.[i],
    rainProb: d.precipitation_probability_max?.[i] ?? 0,
    gust: d.wind_gusts_10m_max?.[i] ?? 0,
  }))
}

const dayName = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })

// Month-by-month fallback when the forecast is unremarkable.
const SEASONAL = {
  January: "Deep winter: keep an ear on the heat and let faucets drip on the coldest nights.",
  February: "Late winter: a good month to book spring services before calendars fill.",
  March: "Thaw season: first gutter check of the year and a look at winter's wear outside.",
  April: "Spring: AC gets its shakedown this month — better to find issues now than in July.",
  May: "Growing season: keep vegetation off the AC condenser and check irrigation.",
  June: "Early summer: AC season begins in earnest; a clean filter earns its keep now.",
  July: "High summer: heat is the season's main stress — filters, condensate lines, shade.",
  August: "Late summer: last calm stretch to book fall services before the rush.",
  September: "Early fall: heating gets its first test soon — service it before the first cold night.",
  October: "Leaf season: gutters earn their keep this month; book the cleaning for after the drop.",
  November: "First freezes: disconnect hoses, find the shutoffs, winterize outside faucets.",
  December: "Winter proper: ice dams and frozen pipes are the season's watch items.",
}

// The week's sky: scan the forecast for the first thing worth acting on.
// hasWell adds the power-outage-means-no-water note where it belongs.
function skyLine(days = [], month = "", { hasWell = false } = {}) {
  const freeze = days.find((d) => d.min != null && d.min <= 30)
  if (freeze) {
    return `Freeze ahead — ${dayName(freeze.date)} night dips to ${Math.round(freeze.min)}°. Disconnect hoses and know your outside-faucet shutoffs.${hasWell ? " On a well, a long power cut also means no water — the Emergency Card has the details." : ""}`
  }
  const heat = days.filter((d) => d.max != null && d.max >= 95)
  if (heat.length >= 2) {
    return `A hot stretch: ${heat.length} days at 95°+ ahead (peak ${Math.round(Math.max(...heat.map((d) => d.max)))}°). The AC will be working hard — keep the filter fresh and the setback modest.`
  }
  const wind = days.find((d) => d.gust >= 45)
  if (wind) {
    return `Strong winds ${dayName(wind.date)} (gusts near ${Math.round(wind.gust)} mph). Worth a look at loose limbs over the roof line; we'll check gutters and downspouts after it passes.`
  }
  const wet = days.filter((d) => d.rainProb >= 60)
  if (wet.length >= 3) {
    return `A wet run — rain likely ${wet.length} of the next ${days.length} days. Gutters and grading do their real work this week${hasWell ? "; the sump gets its workout too" : ""}.`
  }
  return SEASONAL[month] || "A quiet stretch of weather ahead."
}

// --- Sections --------------------------------------------------------------

function doneLines(jobs, now) {
  const weekAgo = now.getTime() - 7 * 86_400_000
  return jobs
    .filter((j) => (j.status || "completed") === "completed")
    .filter((j) => {
      const t = when(j.date)
      return !Number.isNaN(t) && t >= weekAgo && t <= now.getTime()
    })
    .map((j) => `${j.title}${j.sub ? ` — ${j.sub}` : ""}${j.date ? ` (${j.date})` : ""}`)
}

const isOpen = (w) => !["done", "canceled", "parked"].includes(w.lane)

// Owner-tagged actions: whose move is it? YOU leads.
function nextLines(workOrders, { dollars = false, todayIso = "" } = {}) {
  const you = []
  const us = []
  const vendor = []
  for (const w of workOrders) {
    if (w.lane === "parked") {
      if (w.revisitOn && w.revisitOn <= todayIso) {
        you.push(`"${w.title}" — you asked us to check back${w.waitingOn ? ` (was waiting on ${w.waitingOn})` : ""}. Ready to pick it up?`)
      }
      continue
    }
    if (!isOpen(w)) continue
    const quotes = w.quotes || []
    if (quotes.length > 0 && !quotes.some((q) => q.chosen)) {
      const amounts = dollars
        ? quotes.map((q) => q.amount).filter(Boolean).join(" and ")
        : ""
      you.push(`Pick a quote for "${w.title}"${amounts ? ` (${amounts} in)` : ` (${quotes.length} in)`}.`)
      continue
    }
    if (w.quoteStatus === "requested") {
      vendor.push(`Awaiting ${w.contractorName || "the contractor"}'s quote on "${w.title}" — we're chasing it.`)
      continue
    }
    if (w.lane === "triage" || w.lane === "quote") {
      us.push(`Arranging "${w.title}"${w.contractorName ? ` with ${w.contractorName}` : ""}.`)
    } else if (w.lane === "in-progress") {
      us.push(`"${w.title}" is underway${w.contractorName ? ` — ${w.contractorName}` : ""}.`)
    }
  }
  return [
    ...you.map((t) => `YOU · ${t}`),
    ...us.map((t) => `US · ${t}`),
    ...vendor.map((t) => `VENDOR · ${t}`),
  ]
}

// Coming ~30 days: scheduled work, this month's care, checks coming due,
// parked revisit dates inside the window.
function comingLines({ workOrders, calendar, systems, now }) {
  const todayIso = now.toISOString().slice(0, 10)
  const monthOut = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  const month = MONTHS[now.getMonth()]

  const scheduled = workOrders
    .filter((w) => w.lane === "scheduled")
    .map((w) => `${w.title}${w.contractorName ? ` — ${w.contractorName}` : ""}${w.scheduledFor ? ` (${w.scheduledFor})` : ""}`)
  const care = calendar
    .filter((t) => t.month === month && t.doneYear !== now.getFullYear())
    .map((t) => `${t.task} — on this month's care plan`)
  const overdue = systems
    .filter((s) => s.nextDue && s.nextDue <= todayIso)
    .map((s) => `${s.category} — recurring check overdue`)
  const checks = systems
    .filter((s) => s.nextDue && s.nextDue > todayIso && s.nextDue <= monthOut)
    .map((s) => `${s.category} — recurring check due ${s.nextDue}`)
  const parked = workOrders
    .filter((w) => w.lane === "parked" && w.revisitOn && w.revisitOn > todayIso && w.revisitOn <= monthOut)
    .map((w) => `"${w.title}" — we check back with you ${w.revisitOn}`)

  return [...scheduled, ...care, ...overdue, ...checks, ...parked]
}

// --- The brief -------------------------------------------------------------

function section(title, lines) {
  if (!lines.length) return ""
  return `${title.toUpperCase()}\n${lines.map((l) => `  • ${l}`).join("\n")}\n\n`
}

function buildBrief({
  profile = {},
  jobs = [],
  workOrders = [],
  calendar = [],
  systems = [],
  forecast = [],
  style = "proactive",
  now = new Date(),
}) {
  const todayIso = now.toISOString().slice(0, 10)
  const month = MONTHS[now.getMonth()]
  const hasWell = systems.some((s) => /well|pressure tank/i.test(`${s.category} ${s.detail || ""}`))

  const sky = skyLine(forecast, month, { hasWell })
  const done = doneLines(jobs, now)
  const next = nextLines(workOrders, { dollars: style === "proactive", todayIso })
  const youCount = next.filter((l) => l.startsWith("YOU")).length

  const headline =
    youCount > 0
      ? `${youCount === 1 ? "One decision is" : `${youCount} decisions are`} waiting on you this week.`
      : "All quiet — nothing needed from you this week."

  let body = `THIS WEEK'S SKY\n  ${sky}\n\n`
  body += section("Done this week", done.length ? done : ["A quiet week — no work closed out."])

  if (style === "proactive") {
    body += section("What's next — whose move it is", next.length ? next : ["Nothing in motion needs a hand."])
    const coming = comingLines({ workOrders, calendar, systems, now })
    body += section(
      "Coming next 30 days",
      coming.length ? coming : ["Nothing on the calendar yet — the care plan picks up next month."]
    )
  }

  const text = `Your home this week — ${profile.address || "your home"}

${headline}

${body}Reply to this email or write in the app — we see it right away.
— ${profile.teamSignature || "Your team at Charlottesville Home & Property Services"}
`
  return {
    subject: `Your home this week — ${profile.address || ""}`.trim(),
    text,
  }
}

// --- RFC-822 mail assembly (unchanged) -------------------------------------

// Non-ASCII header values (the em-dash in every subject) must be RFC
// 2047-encoded or mail clients read the UTF-8 bytes as Latin-1 and
// render mojibake ("Ã¢Â€Â"" where "—" should be).
const encodeHeader = (s) =>
  /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`

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

module.exports = { buildBrief, skyLine, normalizeForecast, rfc822 }
