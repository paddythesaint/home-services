import { describe, it, expect } from "vitest"
import {
  isOpenPriority,
  openRequirements,
  isReadyToAction,
  resolutionCounts,
  visitManifest,
  quoteBundles,
} from "../resolution"

const open = (extra = {}) => ({ id: "p1", title: "Test", ...extra })

describe("isOpenPriority", () => {
  it("treats missing status as open (items predate the field)", () => {
    expect(isOpenPriority(open())).toBe(true)
  })
  it("counts open and scheduled, not resolved or dismissed", () => {
    expect(isOpenPriority(open({ status: "open" }))).toBe(true)
    expect(isOpenPriority(open({ status: "scheduled" }))).toBe(true)
    expect(isOpenPriority(open({ status: "resolved" }))).toBe(false)
    expect(isOpenPriority(open({ status: "dismissed" }))).toBe(false)
  })
})

describe("openRequirements / isReadyToAction", () => {
  it("is trivially ready with no recorded requirements", () => {
    expect(openRequirements(open()).count).toBe(0)
    expect(isReadyToAction(open())).toBe(true)
  })

  it("counts needed materials and open info asks; satisfied ones drop out", () => {
    const p = open({
      materialsNeeded: [
        { id: "m1", item: "Filter", status: "needed" },
        { id: "m2", item: "Rod", status: "purchased" },
        { id: "m3", item: "Caulk", status: "on-truck" },
      ],
      infoNeeded: [
        { id: "i1", ask: "Footage?", status: "open" },
        { id: "i2", ask: "Brand?", status: "provided", answer: "Trane" },
      ],
    })
    const reqs = openRequirements(p)
    expect(reqs.materials.map((m) => m.id)).toEqual(["m1"])
    expect(reqs.info.map((i) => i.id)).toEqual(["i1"])
    expect(reqs.count).toBe(2)
    expect(isReadyToAction(p)).toBe(false)
  })
})

describe("resolutionCounts", () => {
  it("computes the open → ready → next-visit pipeline readout", () => {
    const priorities = [
      open({ id: "a", resolutionPath: "subscription-visit" }), // open, ready, next visit
      open({
        id: "b",
        resolutionPath: "subscription-visit",
        materialsNeeded: [{ id: "m", item: "Part", status: "needed" }],
      }), // open, NOT ready, next visit
      open({ id: "c", resolutionPath: "diy" }), // open, ready
      open({ id: "d", status: "resolved" }), // closed — excluded entirely
    ]
    expect(resolutionCounts(priorities)).toEqual({ open: 3, ready: 2, nextVisit: 2 })
  })
})

describe("visitManifest", () => {
  it("collects open next-visit items and their consolidated materials", () => {
    const priorities = [
      open({
        id: "a",
        title: "Filter swap",
        resolutionPath: "subscription-visit",
        materialsNeeded: [{ id: "m1", item: "Filter", status: "on-truck" }],
      }),
      open({ id: "b", resolutionPath: "diy" }),
      open({ id: "c", status: "resolved", resolutionPath: "subscription-visit" }),
    ]
    const manifest = visitManifest(priorities)
    expect(manifest.items.map((p) => p.id)).toEqual(["a"])
    expect(manifest.materials).toEqual([
      { id: "m1", item: "Filter", status: "on-truck", priorityId: "a", priorityTitle: "Filter swap" },
    ])
  })
})

describe("quoteBundles", () => {
  it("groups open project-quote work by bundle tag, blank tags as Ungrouped", () => {
    const priorities = [
      open({ id: "a", resolutionPath: "project-quote", bundleTag: "Exterior package" }),
      open({ id: "b", resolutionPath: "project-quote", bundleTag: "Exterior package" }),
      open({ id: "c", resolutionPath: "project-quote", bundleTag: "  " }),
      open({ id: "d", resolutionPath: "subscription-visit" }),
      open({ id: "e", resolutionPath: "project-quote", status: "resolved" }),
    ]
    const bundles = quoteBundles(priorities)
    expect(bundles).toHaveLength(2)
    const exterior = bundles.find((b) => b.tag === "Exterior package")
    expect(exterior.items.map((p) => p.id)).toEqual(["a", "b"])
    expect(bundles.find((b) => b.tag === "Ungrouped").items.map((p) => p.id)).toEqual(["c"])
  })
})
