import { describe, it, expect } from "vitest"
import { fieldLabel, logFact } from "../facts"
import { __getItems } from "../mocks/firestoreApi"

describe("fieldLabel", () => {
  it("maps structured field keys to readable names", () => {
    expect(fieldLabel("installYear")).toBe("install year")
    expect(fieldLabel("lastServiced")).toBe("last serviced")
  })
  it("passes unknown keys through", () => {
    expect(fieldLabel("somethingNew")).toBe("somethingNew")
  })
})

describe("logFact", () => {
  it("writes a fact-type activity entry carrying provenance", async () => {
    await logFact(
      "prop-ballard",
      "sys-hvac",
      "Set location, condition",
      { type: "walkthrough", label: "walkthrough" },
      "July 4, 2026"
    )
    const activity = __getItems("prop-ballard", "activity")
    const fact = activity.find((a) => a.summary === "Set location, condition")
    expect(fact).toMatchObject({
      systemId: "sys-hvac",
      type: "fact",
      source: { type: "walkthrough", label: "walkthrough" },
      date: "July 4, 2026",
    })
  })

  it("defaults the date to today when none is given", async () => {
    await logFact("prop-ballard", "sys-hvac", "No-date fact", { type: "t", label: "l" })
    const fact = __getItems("prop-ballard", "activity").find((a) => a.summary === "No-date fact")
    expect(fact.date).toBeTruthy()
  })
})
