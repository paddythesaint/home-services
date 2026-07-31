// Address research (7/31): the two-step signup's second step. The founder
// creates a home with little more than the address and the homeowner's
// email; this researcher then works that ONE address against public
// sources — county assessor/GIS pages, listing sites (Zillow, Redfin,
// Realtor), FEMA — via the web-search tool, and returns profile basics
// plus sourced facts. Targeted, never a broad sweep; everything it files
// is stamped unverified until the walkthrough or the owner confirms it.
//
// Pure: prompt, parse, gap-fill, and the API call (fetch-injected) live
// here; the scheduled sweep in index.js owns Firestore.

const RESEARCH_TOOLS = [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]

// Profile fields research may fill — ONLY where the form left them blank.
const PROFILE_KEYS = ["yearBuilt", "acreage", "bedrooms", "bathrooms", "parcelId", "areaLabel"]

function researchSystemPrompt(profile = {}) {
  const address = [profile.address, profile.areaLabel].filter(Boolean).join(", ")
  return `ADDRESS RESEARCH
You are the property researcher for a home-management service. Research this ONE specific address using web search — county assessor and GIS records, real-estate listing pages (Zillow, Redfin, Realtor.com), and other public records. Never research any other property, person, or general topic.

THE ADDRESS: ${address}

Search for the property's public record. Prioritize: year built, lot acreage, bedrooms, bathrooms, parcel/tax-map ID, finished square footage, construction/exterior type, roof material and any visible replacement date, heating fuel and system type, water source (well vs municipal), sewer (septic vs public), last sale date and price, current assessed value. Prefer county/official sources over listing sites when they disagree, and say which source each item came from.

Reply in EXACTLY this format, nothing before or after:
PROFILE:
yearBuilt: <4-digit year or unknown>
acreage: <number or unknown>
bedrooms: <number or unknown>
bathrooms: <number or unknown>
parcelId: <parcel / tax-map id or unknown>
areaLabel: <city, state zip or unknown>
FACTS:
- <category> | <one clear sentence, with the source named, e.g. "Roof is architectural shingle, replaced ~2018 per the 2021 Redfin listing.">
(3 to 10 facts; only include what a source actually states — never guess or average)
NOTE: <one sentence for the team: overall confidence and which sources answered>`
}

// Parse the fixed shape; "unknown" and empty values drop out.
function parseResearch(raw = "") {
  const profile = {}
  for (const key of PROFILE_KEYS) {
    const v = (raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m")) || [])[1]?.trim() || ""
    if (v && !/^unknown$/i.test(v)) profile[key] = v
  }
  const factsBlock = (raw.split(/^FACTS:$/m)[1] || "").split(/^NOTE:/m)[0]
  const facts = factsBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") && l.includes("|"))
    .map((l) => {
      const [category, ...rest] = l.slice(2).split("|")
      return { category: category.trim(), text: rest.join("|").trim() }
    })
    .filter((f) => f.text.length > 3)
  const note = (raw.match(/^NOTE:\s*(.+)$/m) || [])[1]?.trim() || ""
  return { profile, facts, note }
}

// Research fills only what the form left blank — a founder-entered value
// always wins over a scraped one.
function fillProfileGaps(current = {}, found = {}) {
  const patch = {}
  for (const key of PROFILE_KEYS) {
    const has = current[key] !== undefined && current[key] !== null && `${current[key]}`.trim() !== ""
    if (!has && found[key]) patch[key] = found[key]
  }
  return patch
}

// Same pause_turn loop as the outreach drafter: searching turns can stop
// midway; resume until the model finishes, then join every text block.
async function runResearch({ apiKey, model, maxTokens, system, fetchImpl = fetch }) {
  let messages = [{ role: "user", content: "Research this address." }]
  for (let turn = 0; turn < 6; turn++) {
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
        messages,
        tools: RESEARCH_TOOLS,
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const data = await res.json()
    if (data.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: data.content }]
      continue
    }
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
    if (!text) throw new Error("empty research")
    return text
  }
  throw new Error("research did not finish (pause_turn loop cap)")
}

module.exports = { RESEARCH_TOOLS, researchSystemPrompt, parseResearch, fillProfileGaps, runResearch }
