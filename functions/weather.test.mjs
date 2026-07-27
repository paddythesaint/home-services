// Unit tests for the weather-nudge mapper. Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { weatherNudges, pointFor } = require("./weather.js")

const alert = (event, over = {}) => ({
  id: `urn:oid:x.${event.replace(/\W+/g, "")}`,
  event,
  headline: `${event} until Tuesday`,
  onset: "2026-11-20T18:00:00-05:00",
  ends: "2026-11-21T10:00:00-05:00",
  ...over,
})

test("freeze warnings personalize for a home with a well", () => {
  const withWell = weatherNudges([alert("Freeze Warning")], [{ category: "Private Well" }])
  assert.equal(withWell.length, 1)
  assert.equal(withWell[0].key, "freeze")
  assert.match(withWell[0].advice, /wrap the outdoor spigots/)
  assert.match(withWell[0].advice, /well-house/)

  const noWell = weatherNudges([alert("Freeze Warning")], [{ category: "HVAC" }])
  assert.doesNotMatch(noWell[0].advice, /well-house/)
})

test("flood advice mentions the sump pump only when there is one", () => {
  const sump = weatherNudges([alert("Flood Watch")], [{ category: "Sump Pump" }])
  assert.match(sump[0].advice, /sump pump/)
  const noSump = weatherNudges([alert("Flood Watch")], [])
  assert.doesNotMatch(noSump[0].advice, /sump pump/)
})

test("irrelevant alert classes produce nothing", () => {
  const nudges = weatherNudges(
    [alert("Special Weather Statement"), alert("Rip Current Statement"), { event: "Freeze Warning" }],
    []
  )
  // The two unknown classes drop; the freeze alert without an id drops too.
  assert.equal(nudges.length, 0)
})

test("winter storms nudge the generator owner to listen for the self-test", () => {
  const n = weatherNudges([alert("Winter Storm Warning")], [{ category: "Standby Generator" }])
  assert.match(n[0].advice, /generator/)
  assert.equal(n[0].endsAt, "2026-11-21T10:00:00-05:00")
})

test("pointFor reads the ZIP from areaLabel with a Charlottesville default", () => {
  assert.equal(pointFor({ areaLabel: "Charlottesville, VA 22901" }), "38.08,-78.55")
  assert.equal(pointFor({}), "38.08,-78.55")
  assert.equal(pointFor({ areaLabel: "Richmond, VA 23059" }), "37.55,-77.46")
})
