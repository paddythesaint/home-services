// Weather nudges — the pure half. The daily check (index.js) pulls active
// National Weather Service alerts for the home's area; this turns the
// relevant ones into home-specific advice, personalized by what the
// registry says the home actually has (a well house, a generator, a sump
// pump). Unrecognized alert types produce nothing — silence beats noise.

const hasSystem = (systems, re) =>
  systems.some((s) => re.test(`${s.category || ""} ${s.detail || ""}`))

const CLASSES = [
  {
    key: "freeze",
    re: /freeze|frost/i,
    advice: (systems) => {
      const bits = [
        "Disconnect garden hoses and wrap the outdoor spigots; let a faucet drip on the coldest nights.",
      ]
      if (hasSystem(systems, /well|pressure tank/i))
        bits.push("Check the well-house heat lamp or insulation while you're out there.")
      return bits.join(" ")
    },
  },
  {
    key: "wind",
    re: /high wind|wind advisory|hurricane|tropical storm/i,
    advice: () =>
      "Bring in or tie down outdoor furniture, and glance at the trees over the roofline — we'll check for lifted shingles after it passes.",
  },
  {
    key: "flood",
    re: /flood/i,
    advice: (systems) =>
      hasSystem(systems, /sump/i)
        ? "Make sure the sump pump outlet is clear and the pit isn't already high — and keep an eye on the basement."
        : "Keep an eye on the basement and anywhere water has found its way in before.",
  },
  {
    key: "winter",
    re: /winter storm|ice storm|blizzard|heavy snow/i,
    advice: (systems) => {
      const bits = ["Stock what you'd want for a day or two without power."]
      if (hasSystem(systems, /generator/i))
        bits.push("Your standby generator should self-test — if you don't hear it exercise, tell us.")
      return bits.join(" ")
    },
  },
  {
    key: "heat",
    re: /excessive heat|heat advisory/i,
    advice: () =>
      "Ease the HVAC's load: close blinds on the sun side and don't chase a big temperature drop mid-afternoon.",
  },
]

// alerts: normalized [{ id, event, headline, onset, ends }] (the scheduled
// job maps NWS GeoJSON features down to this before calling).
// → nudges: [{ id, key, event, headline, advice, startsAt, endsAt }]
function weatherNudges(alerts = [], systems = []) {
  const nudges = []
  for (const a of alerts) {
    const cls = CLASSES.find((c) => c.re.test(a.event || ""))
    if (!cls || !a.id) continue
    nudges.push({
      id: a.id,
      key: cls.key,
      event: a.event,
      headline: a.headline || a.event,
      advice: cls.advice(systems),
      startsAt: a.onset || "",
      endsAt: a.ends || "",
    })
  }
  return nudges
}

// The home's lat/lon for the NWS point query. ZIP-prefix table with a
// Charlottesville default — precision to the county is all alerts need.
const ZIP_POINTS = {
  229: [38.08, -78.55], // Charlottesville / Albemarle
  228: [38.45, -78.87], // Harrisonburg side
  230: [37.55, -77.46], // Richmond side
}

function pointFor(profile = {}) {
  const zip = (`${profile.areaLabel || ""} ${profile.zip || ""}`.match(/\b(\d{5})\b/) || [])[1]
  const [lat, lon] = (zip && ZIP_POINTS[zip.slice(0, 3)]) || ZIP_POINTS["229"]
  return `${lat},${lon}`
}

module.exports = { weatherNudges, pointFor }
