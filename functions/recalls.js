// CPSC recall matching — the pure half. The weekly scan (index.js) pulls
// recalls from the SaferProducts REST API per manufacturer; this decides
// which ones plausibly concern which registered systems. Deliberately
// conservative: a finding needs BOTH the brand to match AND product
// context to overlap — a brand-only hit across unrelated product lines
// is noise that costs trust.

const STOP = new Set([
  "the", "and", "with", "for", "from", "unit", "system", "systems", "home",
  "whole", "main", "second", "zone", "ton",
])

const tokens = (s = "") =>
  (s.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []).filter((t) => !STOP.has(t))

const recallText = (r) =>
  [
    r.Title || "",
    r.Description || "",
    ...(r.Products || []).map((p) => `${p.Name || ""} ${p.Description || ""} ${p.Model || ""}`),
  ]
    .join(" ")
    .toLowerCase()

const recallBrands = (r) =>
  [...(r.Manufacturers || []).map((m) => m.Name || ""), r.Title || ""].join(" ").toLowerCase()

// systems: [{ id, category, brand, detail }] · recalls: raw CPSC records.
// → findings: [{ systemId, systemCategory, brand, recallNumber, title,
//               url, date, hazard }], newest first, ≤3 per system.
function recallMatches(systems = [], recalls = []) {
  const findings = []
  for (const s of systems) {
    const brand = (s.brand || "").trim().toLowerCase()
    if (brand.length < 3) continue
    const context = tokens(`${s.category || ""} ${s.detail || ""}`)
    if (context.length === 0) continue
    let count = 0
    for (const r of recalls) {
      if (count >= 3) break
      if (!recallBrands(r).includes(brand)) continue
      const text = recallText(r)
      if (!context.some((t) => text.includes(t))) continue
      findings.push({
        systemId: s.id,
        systemCategory: s.category || "",
        brand: s.brand,
        recallNumber: r.RecallNumber || String(r.RecallID || ""),
        title: r.Title || "",
        url: r.URL || "",
        date: (r.RecallDate || "").slice(0, 10),
        hazard: (r.Hazards || []).map((h) => h.Name).filter(Boolean).join("; "),
      })
      count += 1
    }
  }
  return findings.sort((a, b) => (b.date || "").localeCompare(a.date || ""))
}

// Distinct scan-worthy brands on a registry (dedup, ≥3 chars).
function scanBrands(systems = []) {
  return [
    ...new Set(
      systems
        .map((s) => (s.brand || "").trim())
        .filter((b) => b.length >= 3)
        .map((b) => b.toLowerCase())
    ),
  ]
}

module.exports = { recallMatches, scanBrands }
