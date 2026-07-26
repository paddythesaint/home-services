// The Emergency Card's brain: derive "what to shut off and who to call"
// from the record — no separate emergency database to maintain. Shutoff
// knowledge accumulates as facts (walkthroughs, the assistant, email
// intake) and as system locations; this groups it for the worst moment.

import { DESIGNATED_PROS } from "./designations"
import { TEAM } from "./team"

const SHUTOFF_GROUPS = [
  {
    key: "water",
    label: "Water",
    hint: "Flooding or a burst pipe — shut the water first.",
    // Water terms only — a generic "shutoff valve" would steal the propane
    // and gas facts (groups match first-wins, water first).
    re: /water (main|shut.?off|pump)|main water|pressure tank|well pump/i,
  },
  {
    key: "power",
    label: "Electrical",
    hint: "Sparks, burning smell, or a soaked outlet — kill the power.",
    re: /breaker|electrical panel|main panel|disconnect|generator/i,
  },
  {
    key: "fuel",
    label: "Gas & fuel",
    hint: "Smell gas? Shut the valve, get out, call from outside.",
    re: /propane|gas (valve|shut.?off|line|meter)|fuel tank|oil tank/i,
  },
  {
    key: "septic",
    label: "Septic & alarms",
    hint: "An alarm sounding usually buys you time — but not much.",
    re: /septic (alarm|tank|system)|sump pump|alarm panel/i,
  },
]

// Grouped shutoff knowledge: matching active facts first (the specific
// "where exactly" sentences), then located systems as fallback anchors.
export function emergencyShutoffs(facts = [], systems = []) {
  const groups = SHUTOFF_GROUPS.map((g) => ({ ...g, entries: [] }))
  const place = (text, source, matchAgainst) => {
    for (const g of groups) {
      if (g.re.test(matchAgainst)) {
        g.entries.push({ text, source })
        return
      }
    }
  }
  for (const f of facts) {
    if (f.archived) continue
    place(f.text || "", f.date ? `noted ${f.date}` : "on the record", f.text || "")
  }
  for (const s of systems) {
    if (!s.location) continue
    place(
      `${s.category} — in the ${s.location.toLowerCase()}`,
      s.verified ? "verified in person" : "on the record",
      `${s.category} ${s.detail || ""}`
    )
  }
  return groups.filter((g) => g.entries.length > 0)
}

// Who to call, in order: the team (always first), then the designated pro
// per trade — with a phone number when the home's roster has one.
export function emergencyContacts(contractors = []) {
  const phoneFor = (name) =>
    contractors.find((c) => (c.name || "").toLowerCase() === name.toLowerCase())?.phone || ""
  return [
    ...TEAM.map((t) => ({
      name: t.name,
      role: t.title,
      phone: t.phone || "",
      team: true,
    })),
    ...DESIGNATED_PROS.map((d) => ({
      name: d.name,
      role: `${d.trade}${d.interim ? " · interim" : ""}`,
      phone: phoneFor(d.name),
      team: false,
    })),
  ]
}
