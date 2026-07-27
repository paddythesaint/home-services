// The repair-vs-replace doctrine: transparent rules over age, recent
// repair spend, and the 50% rule. Verdict sentences are currency-free
// (Simple-safe); dollars ride in costNotes.

import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { renderPage } from "./renderPage"
import { repairVsReplace } from "../repairVsReplace"
import SystemProfile from "../pages/SystemProfile"

const NOW = new Date("2026-07-27")
// Plain "HVAC" benchmark: typical life ~12–17, replacement $7,000–14,000.
const hvac = (installYear) => ({ id: "s1", category: "HVAC", installYear: String(installYear) })

describe("repairVsReplace (pure)", () => {
  it("young system → repair; no doctrine without an install year", () => {
    const d = repairVsReplace(hvac(2024), { now: NOW })
    expect(d.verdict).toBe("repair")
    expect(d.headline).toBe("Repair it.")
    expect(repairVsReplace({ id: "x", category: "HVAC" }, { now: NOW })).toBeNull()
  })

  it("past typical life → replace", () => {
    const d = repairVsReplace(hvac(2005), { now: NOW })
    expect(d.verdict).toBe("replace")
    expect(d.reasons[0]).toMatch(/beyond its typical life/)
  })

  it("in the window: quiet unit leans replace, repair-heavy unit says replace", () => {
    const quiet = repairVsReplace(hvac(2012), { now: NOW })
    expect(quiet.verdict).toBe("lean-replace")

    const heavy = repairVsReplace(hvac(2012), {
      now: NOW,
      jobs: [
        { title: "Compressor repair", category: "HVAC", cost: "$1,600", date: "March 2, 2026", status: "completed" },
        { title: "Refrigerant leak fix", category: "HVAC", cost: "$700", date: "August 9, 2025", status: "completed" },
      ],
    })
    expect(heavy.verdict).toBe("replace")
    expect(heavy.costNotes[0]).toMatch(/\$2,300 into repairs/)
    // Old spend doesn't count: same jobs dated 2019 → back to lean-replace.
    const old = repairVsReplace(hvac(2012), {
      now: NOW,
      jobs: [{ title: "Compressor repair", category: "HVAC", cost: "$2,300", date: "March 2, 2019", status: "completed" }],
    })
    expect(old.verdict).toBe("lean-replace")
  })

  it("the 50% rule upgrades the verdict when an estimate is in hand", () => {
    const d = repairVsReplace(hvac(2016), { now: NOW, estimate: 4000 })
    expect(d.verdict).not.toBe("repair")
    expect(d.costNotes.join(" ")).toMatch(/50% rule/)
  })

  it("verdict sentences stay currency-free; dollars live in costNotes", () => {
    const d = repairVsReplace(hvac(2012), {
      now: NOW,
      jobs: [{ title: "Compressor repair", category: "HVAC", cost: "$2,400", date: "May 1, 2026", status: "completed" }],
    })
    expect(d.reasons.join(" ")).not.toMatch(/\$/)
    expect(d.costNotes.join(" ")).toMatch(/\$/)
  })
})

describe("doctrine on the system dossier", () => {
  it("renders the verdict card for a dated system", async () => {
    renderPage(<SystemProfile />, { path: "/system/sys-hvac", routePath: "system/:systemId" })
    expect(await screen.findByText("If it acts up: repair or replace?")).toBeInTheDocument()
    expect(screen.getAllByText(/Repair it\.|Replace it\.|plan the replacement/).length).toBeGreaterThan(0)
  })
})
