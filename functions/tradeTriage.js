// Trade triage: the specialist assessment that runs on every new intake
// work order, in parallel with (never in front of) the request itself.
// One assessor, five trade checklists — the model brings the domain
// reasoning; these checklists are HPS's own operational doctrine and are
// MEANT to be edited as the team learns ("always check crawlspace access
// before quoting plumbing on older county homes" belongs here).
//
// Pure: classification, prompt, parse, and the API call (fetch-injected)
// live here; the scheduled sweep in index.js owns Firestore.

const TRADE_CHECKLISTS = {
  electrical: `ELECTRICAL CHECKLIST
- Safety first: sparking, burning smell, warm outlets/panel, repeated breaker trips, or aluminum branch wiring → treat as URGENT or EMERGENCY, never routine.
- Material gaps to check: panel brand/capacity on record (Federal Pacific/Zinsco panels are replace-on-sight), photo of the panel, whether the issue is one fixture or a whole circuit, GFCI presence where code wants it (kitchen/bath/exterior).
- A pro would ask: exactly which outlets/fixtures, when it happens (constant vs intermittent), any recent work or new appliances on that circuit.
- Constructability: 1990s-era homes here often need AFCI upgrades when touched; permit + inspection required for panel or circuit work in Albemarle County.`,
  plumbing: `PLUMBING CHECKLIST
- Safety first: active leaks near electrical, sewage backup, no water on a well home → URGENT or EMERGENCY.
- Material gaps: where the main shutoff is (Emergency Card), pipe material if known (poly/galvanized raises scope), well vs municipal, water heater age and location (finished space above = damage risk), photos of the leak and surroundings.
- A pro would ask: constant drip vs under-use only, hot side or cold side, how long it's been happening, water discoloration or pressure change.
- Constructability: well homes — check pressure tank and treatment equipment proximity before quoting; access to crawlspaces/ceilings drives cost more than the fix itself.`,
  hvac: `HVAC CHECKLIST
- Safety first: gas smell, CO alarm, or no heat in freezing weather / no AC in dangerous heat for vulnerable occupants → URGENT or EMERGENCY.
- Material gaps: make/model/age on record, last service date, filter size and last change, whether the issue is airflow, temperature, noise, or cycling; thermostat brand.
- A pro would ask: is the outdoor unit running, any ice on the lines, when it last worked normally, one zone or whole house.
- Constructability: units in the replacement window (15+ years) — flag repair-vs-replace before authorizing a major repair; refrigerant type matters (R-22 systems are end-of-life economics).`,
  exterior: `EXTERIOR CHECKLIST
- Safety first: tree on structure, active roof leak over living space, hanging limbs over service lines → URGENT or EMERGENCY.
- Material gaps: roof age/material on record, gutter type, photos of the affected area from the ground, approximate linear/square footage for quotable scopes, HOA or historic-district constraints if any.
- A pro would ask: when it started, does it worsen with rain/wind direction, one-story or two-story access, ladder vs lift work.
- Constructability: weather-window trades — sequence before interior finishes; bundling same-elevation work (gutters + trim + roofline) shares mobilization cost.`,
  appliance: `APPLIANCE CHECKLIST
- Safety first: burning smell, gas appliances misbehaving, water spreading from the unit → URGENT.
- Material gaps: brand/model/serial on record (drives parts and recall checks), age, symptom precision (won't start vs starts-then-stops vs noise), photos of model sticker.
- A pro would ask: any error codes displayed, does it trip the breaker, when it last worked.
- Constructability: units under ~6 years usually repair; over 10, price the replacement before authorizing parts; check the record's recall findings for this model first.`,
  general: `GENERAL CHECKLIST
- Safety first: anything involving gas, active water near electrical, or structural movement → escalate.
- Material gaps: photos, precise location in the home, when it started, any related record history.
- A pro would ask: what changed recently (weather, work done, new equipment), is it worsening.
- Constructability: classify the trade before quoting; multi-trade scopes should be split or explicitly bundled, never quoted vaguely.`,
}

// Deterministic first-pass classification; the model confirms or corrects.
function tradeFor(order = {}) {
  const hay = `${order.category || ""} ${order.title || ""} ${order.notes || ""}`.toLowerCase()
  if (/outlet|breaker|panel|wiring|electric|spark|gfci|light switch|ceiling fan/.test(hay)) return "electrical"
  if (/leak|pipe|drain|faucet|toilet|water heater|sump|well |softener|sewer|plumb/.test(hay)) return "plumbing"
  if (/hvac|furnace|a\/c|\bac\b|air condition|heat pump|thermostat|duct|cooling|heating/.test(hay)) return "hvac"
  if (/roof|gutter|siding|fence|deck|paint|window|door|tree|driveway|exterior|yard|drainage/.test(hay)) return "exterior"
  if (/fridge|refrigerator|dishwasher|washer|dryer|oven|range|disposal|microwave|appliance/.test(hay)) return "appliance"
  return "general"
}

const TRIAGE_MARKER = "TRADE TRIAGE"

function triageSystemPrompt({ order, systems = [], facts = [] }) {
  const trade = tradeFor(order)
  const sysLines = systems
    .slice(0, 40)
    .map((s) => `- ${s.category}${s.detail ? ` — ${s.detail}` : ""}${s.installYear ? ` (installed ${s.installYear})` : ""}${s.condition ? ` [${s.condition}]` : ""}`)
    .join("\n")
  const factLines = facts
    .slice(0, 40)
    .map((f) => `- ${f.text || f.fact || ""}`)
    .filter((l) => l.length > 3)
    .join("\n")

  return `${TRIAGE_MARKER}
You are HPS's ${trade} triage specialist — the experienced hand who reads every incoming request before anyone rolls a truck. Assess the work order below against the checklist and the home's record. Be concrete and terse; this is an internal operational read, never shown to the client.

${TRADE_CHECKLISTS[trade]}

HOME SYSTEMS ON RECORD:
${sysLines || "- (none recorded)"}

RECORD FACTS (selected):
${factLines || "- (none)"}

THE REQUEST:
- Title: ${order.title}
- Client's words: ${order.notes || "(no detail captured)"}
- Category: ${order.category || "unspecified"}

Reply in EXACTLY this format, nothing before or after:
TRADE: <electrical|plumbing|hvac|exterior|appliance|general — correct the classification if the checklist trade is wrong>
URGENCY: <emergency|urgent|routine> — <one short reason>
GAPS: <the material gaps in the request or the record that block a good quote, separated by "; " — or "none">
ASK: <up to 3 questions for the homeowner, separated by " | " — or "none">
NOTES: <1-2 sentences of constructability/scoping judgement for the ops lead — sequencing, bundling, repair-vs-replace, permits>`
}

// Parse the fixed shape; tolerate missing lines.
function parseTriage(raw = "") {
  const line = (k) => (raw.match(new RegExp(`^${k}:\\s*(.+)$`, "m")) || [])[1]?.trim() || ""
  const urgencyRaw = line("URGENCY")
  const urgency = (urgencyRaw.match(/^(emergency|urgent|routine)/i) || [])[1]?.toLowerCase() || ""
  return {
    trade: line("TRADE").split(/[\s—-]/)[0].toLowerCase(),
    urgency,
    urgencyReason: urgencyRaw.replace(/^(emergency|urgent|routine)\s*[—-]?\s*/i, ""),
    gaps: line("GAPS"),
    questions: line("ASK"),
    notes: line("NOTES"),
  }
}

// One plain call — no tools, no loop.
async function runTriage({ apiKey, model, maxTokens, system, fetchImpl = fetch }) {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: "Triage this work order." }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
  if (!text) throw new Error("empty triage")
  return text
}

module.exports = { TRADE_CHECKLISTS, tradeFor, triageSystemPrompt, parseTriage, runTriage }
