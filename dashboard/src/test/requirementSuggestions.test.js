import { describe, it, expect } from "vitest"
import { suggestRequirements } from "../requirementSuggestions"

describe("suggestRequirements", () => {
  it("suggests typical materials and info asks for a recognized task", () => {
    const s = suggestRequirements({ title: "Re-caulk master bath shower", category: "Interior" })
    expect(s.materials.map((m) => m.item)).toContain("Silicone caulk")
    expect(s.info.map((i) => i.ask)).toContain("Color/finish to match?")
  })

  it("never re-suggests what the record already tracks", () => {
    const s = suggestRequirements({
      title: "Replace HVAC filter",
      materialsNeeded: [{ item: "16x25x1 MERV 11 filter", spec: "3-pack", status: "on-truck" }],
      infoNeeded: [],
    })
    // The filter material is covered; the size ask is not (already known via
    // the spec'd material? — no: dedupe is per-requirement, and no info ask
    // mentions size yet).
    expect(s.materials.map((m) => m.item)).not.toContain("Replacement filter")
    expect(s.info.map((i) => i.ask)).toContain(
      "Filter size (printed on the rim of the current filter)?"
    )
  })

  it("dedupes across multiple matching playbooks (one photo ask max)", () => {
    const s = suggestRequirements({ title: "Roof leak above window" })
    const photoAsks = s.info.filter((i) => i.type === "photo")
    expect(photoAsks.length).toBeLessThanOrEqual(1)
  })

  it("caps total suggestions to stay useful, not noisy", () => {
    const s = suggestRequirements({
      title: "Leaky faucet, cracked window, peeling paint, dead outlet and a broken fence",
    })
    expect(s.materials.length + s.info.length).toBeLessThanOrEqual(4)
  })

  it("suggests nothing for tasks it has no playbook for", () => {
    const s = suggestRequirements({ title: "Organize the garage shelves" })
    expect(s.materials).toHaveLength(0)
    expect(s.info).toHaveLength(0)
  })
})
