import { describe, it, expect } from "vitest"
import { zipFromProfile, regionForZip, climateFor } from "../climate"

describe("climate inference", () => {
  it("pulls a 5-digit ZIP from wherever it sits on the record", () => {
    expect(zipFromProfile({ areaLabel: "Charlottesville, VA 22901" })).toBe("22901")
    expect(zipFromProfile({ zip: "85001" })).toBe("85001")
    expect(zipFromProfile({ address: "1 Main St, Miami FL 33101-4567" })).toBe("33101")
    expect(zipFromProfile({ areaLabel: "no zip here" })).toBe("")
    expect(zipFromProfile(null)).toBe("")
  })

  it("maps ZIP prefixes to climate regions, defaulting to temperate", () => {
    expect(regionForZip("22901")).toBe("temperate") // Charlottesville, VA
    expect(regionForZip("02138")).toBe("cold") // Cambridge, MA
    expect(regionForZip("33101")).toBe("subtropical") // Miami, FL
    expect(regionForZip("85001")).toBe("hot-dry") // Phoenix, AZ
    expect(regionForZip("98101")).toBe("marine") // Seattle, WA
    expect(regionForZip("29401")).toBe("hot-humid") // Charleston, SC
    expect(regionForZip("")).toBe("temperate")
    expect(regionForZip("00000")).toBe("temperate")
  })

  it("resolves a profile straight to its region object", () => {
    expect(climateFor({ areaLabel: "Charlottesville, VA 22901" }).id).toBe("temperate")
    expect(climateFor({ areaLabel: "Phoenix, AZ 85001" }).id).toBe("hot-dry")
    expect(climateFor(null).id).toBe("temperate")
  })
})
