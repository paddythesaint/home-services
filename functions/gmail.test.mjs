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

test("routeMessage: tag wins, then sender membership, then single-home fallback", () => {
  const one = [{ id: "p1", address: "895 Old Ballard" }]
  assert.equal(routeMessage("", one).id, "p1")
  assert.equal(routeMessage("anything", one).id, "p1")

  const two = [
    { id: "p1", emailTag: "895", memberEmails: ["paddythesaint@gmail.com", "sally@example.com"] },
    { id: "p2", emailTag: "ridgeview", memberEmails: ["paddythesaint@gmail.com", "alex@example.com"] },
  ]
  // 1 · Explicit tag always wins.
  assert.equal(routeMessage("ridgeview", two).id, "p2")
  // 2 · Untagged mail routes by unique membership — clients and pilots
  //     never need the +tag.
  assert.equal(routeMessage("", two, "Alex <alex@example.com>").id, "p2")
  assert.equal(routeMessage("", two, "Sally Ryan <Sally@Example.com>").id, "p1")
  // A founder who belongs to BOTH homes is ambiguous without a tag.
  assert.equal(routeMessage("", two, "paddythesaint@gmail.com"), null)
  // Tag rescues the ambiguous founder.
  assert.equal(routeMessage("895", two, "paddythesaint@gmail.com").id, "p1")
  // 3 · Unknown sender, no tag, multiple homes → unrouted.
  assert.equal(routeMessage("", two, "stranger@example.com"), null)
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

test("partitionIntakeActions: facts auto-file; consequential actions still confirm", () => {
  const { partitionIntakeActions } = require("./gmail.js")
  const { autoFile, confirm } = partitionIntakeActions([
    { type: "save_fact", fact: "Radon average 1.2 pCi/L, week 30.", status: "pending" },
    { type: "save_fact", fact: "  ", status: "pending" }, // empty fact → keep human eyes on it
    { type: "service_request", title: "Leak under sink", status: "pending" },
    { type: "log_job", title: "Gutter cleaning", status: "pending" },
  ])
  assert.equal(autoFile.length, 1)
  assert.equal(autoFile[0].status, "done")
  assert.equal(autoFile[0].auto, true)
  assert.equal(confirm.length, 3)
  assert.ok(confirm.every((a) => a.status === "pending"))
})
