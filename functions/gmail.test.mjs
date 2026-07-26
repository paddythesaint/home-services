// Unit tests for the pure Gmail-intake helpers. Not wired into CI (the
// functions package has no test step) — run manually: node --test functions/
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { extractTag, routeMessage, extractBody, listAttachments, parseActions, intakePrompt } = require("./gmail.js")

const b64url = (s) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_")

test("extractTag finds the +tag in To or Delivered-To", () => {
  assert.equal(
    extractTag([{ name: "To", value: "cvillehomeservicestest+895@gmail.com" }]),
    "895"
  )
  assert.equal(
    extractTag([
      { name: "To", value: "someone@else.com" },
      { name: "Delivered-To", value: "cvillehomeservicestest+ridgeview@gmail.com" },
    ]),
    "ridgeview"
  )
  assert.equal(extractTag([{ name: "To", value: "cvillehomeservicestest@gmail.com" }]), "")
})

test("routeMessage: single property takes everything; multi requires a tag match", () => {
  const one = [{ id: "p1", address: "895 Old Ballard" }]
  assert.equal(routeMessage("", one).id, "p1")
  assert.equal(routeMessage("anything", one).id, "p1")
  const two = [
    { id: "p1", emailTag: "895" },
    { id: "p2", emailTag: "ridgeview" },
  ]
  assert.equal(routeMessage("ridgeview", two).id, "p2")
  assert.equal(routeMessage("", two), null)
  assert.equal(routeMessage("unknown", two), null)
})

test("extractBody prefers text/plain, falls back to stripped html, walks parts", () => {
  const plain = {
    mimeType: "multipart/alternative",
    parts: [
      { mimeType: "text/html", body: { data: b64url("<b>Hi</b>") } },
      { mimeType: "text/plain", body: { data: b64url("Quote is $1,650.") } },
    ],
  }
  assert.equal(extractBody(plain), "Quote is $1,650.")
  const htmlOnly = { mimeType: "text/html", body: { data: b64url("<p>Total: <b>$1,650</b>&nbsp;incl. haul-away</p>") } }
  assert.equal(extractBody(htmlOnly), "Total: $1,650 incl. haul-away")
  assert.equal(extractBody(null), "")
})

test("parseActions extracts valid actions as pending and strips them from the text", () => {
  const raw =
    'This is a quote reply.\n<action>{"type":"log_quote","workOrderId":"wo1","contractor":"Blue Ridge","amount":"$1,650"}</action>\n<action>{"type":"bogus_type"}</action>\n<action>not json</action>'
  const { text, actions } = parseActions(raw)
  assert.equal(text, "This is a quote reply.")
  assert.equal(actions.length, 1)
  assert.deepEqual(actions[0], {
    type: "log_quote",
    workOrderId: "wo1",
    contractor: "Blue Ridge",
    amount: "$1,650",
    status: "pending",
  })
})

test("intakePrompt lists open orders with ids and skips closed ones", () => {
  const p = intakePrompt({
    workOrders: [
      { id: "a", title: "Gutter guards", lane: "quote", quoteStatus: "requested" },
      { id: "b", title: "Done thing", lane: "done" },
    ],
    systems: [{ category: "HVAC" }, { category: "Generator" }],
  })
  assert.match(p, /EMAIL INTAKE/)
  assert.match(p, /- id: a · Gutter guards \(quote: requested\)/)
  assert.doesNotMatch(p, /Done thing/)
  assert.match(p, /HVAC, Generator/)
})

test("listAttachments finds real photos and PDFs, skips signature logos", () => {
  const payload = {
    mimeType: "multipart/mixed",
    parts: [
      { mimeType: "text/plain", body: { data: "aGk=" } },
      // A real nameplate photo.
      { mimeType: "image/jpeg", filename: "nameplate.jpg", body: { attachmentId: "a1", size: 480_000 } },
      // A tiny inline signature logo — below the size floor.
      { mimeType: "image/png", filename: "logo.png", body: { attachmentId: "a2", size: 4_000 } },
      // An invoice PDF (no size floor for PDFs).
      { mimeType: "application/pdf", filename: "invoice.pdf", body: { attachmentId: "a3", size: 9_000 } },
      // Nested multipart with another photo.
      {
        mimeType: "multipart/related",
        parts: [
          { mimeType: "image/png", filename: "unit.png", body: { attachmentId: "a4", size: 300_000 } },
        ],
      },
      // Inline image with no filename (embedded content) — skipped.
      { mimeType: "image/jpeg", filename: "", body: { attachmentId: "a5", size: 900_000 } },
      // Unfiled type.
      { mimeType: "application/zip", filename: "backup.zip", body: { attachmentId: "a6", size: 900_000 } },
    ],
  }
  const atts = listAttachments(payload)
  assert.deepEqual(
    atts.map((a) => a.filename),
    ["nameplate.jpg", "invoice.pdf", "unit.png"]
  )
  assert.equal(atts[0].attachmentId, "a1")
  assert.equal(atts[0].mimeType, "image/jpeg")
})

test("listAttachments caps how many ride along", () => {
  const img = (n) => ({
    mimeType: "image/jpeg",
    filename: `p${n}.jpg`,
    body: { attachmentId: `id${n}`, size: 100_000 },
  })
  const payload = { mimeType: "multipart/mixed", parts: [1, 2, 3, 4, 5, 6].map(img) }
  assert.equal(listAttachments(payload).length, 4)
})

test("listAttachments handles a payload with no parts", () => {
  assert.deepEqual(listAttachments({ mimeType: "text/plain", body: { data: "aGk=" } }), [])
  assert.deepEqual(listAttachments(null), [])
})
