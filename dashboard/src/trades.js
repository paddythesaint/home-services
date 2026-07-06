// The canonical trade taxonomy: how individual cards roll up into the
// groups a homeowner (and a dispatcher) actually thinks in. Free-text
// categories stay free — this maps them, fuzzily, onto a fixed vocabulary
// so grouping is stable no matter what someone typed.
//
// Order matters: earlier trades win ties ("Water Heater" hits Plumbing
// before its "heat" substring could reach HVAC).

export const TRADES = [
  { key: "plumbing", label: "Plumbing", match: /plumb|water heater|pipe|faucet|toilet|shower|bath|drain\b|sump|disposal/i },
  { key: "water", label: "Water & Septic", match: /septic|well\b|radon|water treat|filtration|mitigation/i },
  { key: "hvac", label: "HVAC", match: /hvac|heat|furnace|\ba\/?c\b|air cond|cool|mini.?split|thermostat|duct/i },
  { key: "electrical", label: "Electrical", match: /electric|panel|breaker|generator|wiring|outlet|lighting|light fixture/i },
  { key: "appliances", label: "Appliances", match: /appliance|refrigerator|fridge|dishwasher|oven|range\b|washer|dryer|stove/i },
  { key: "exterior", label: "Roof & Exterior", match: /roof|shingle|gutter|siding|exterior|deck|porch|paint|window|door\b|caulk|drainage|chimney|garage/i },
  { key: "landscaping", label: "Landscaping", match: /landscap|lawn|tree|garden|yard|irrigat|mow|pine|mulch/i },
  { key: "safety", label: "Safety & Air", match: /safety|smoke|co detect|alarm|security|ventilat|insulat|attic|basement|pest|fan\b/i },
]

export const OTHER_TRADE = { key: "other", label: "Other" }

// Match any of an item's descriptive strings against the taxonomy.
export function tradeForText(...texts) {
  const hay = texts.filter(Boolean).join(" ")
  return TRADES.find((t) => t.match.test(hay)) || OTHER_TRADE
}

export const tradeForItem = (item) =>
  tradeForText(item.category, item.title, item.detail, item.task)

// Group items by trade, in canonical order, dropping empty groups.
export function groupByTrade(items) {
  const buckets = new Map()
  for (const item of items) {
    const trade = tradeForItem(item)
    if (!buckets.has(trade.key)) buckets.set(trade.key, { trade, items: [] })
    buckets.get(trade.key).items.push(item)
  }
  return [...TRADES, OTHER_TRADE]
    .map((t) => buckets.get(t.key))
    .filter(Boolean)
}
