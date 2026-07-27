// Unit tests for the background outreach drafter's core loop.
// Run: cd functions && node --test
import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { draftOutreach, OUTREACH_TOOLS } = require("./outreach.js")

const ok = (body) => ({ ok: true, json: async () => body })

test("requests the web_search server tool with a search cap", () => {
  assert.deepEqual(OUTREACH_TOOLS, [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
  ])
})

test("resumes pause_turn turns and joins ALL text blocks", async () => {
  const calls = []
  const replies = [
    ok({
      stop_reason: "pause_turn",
      content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} }],
    }),
    ok({
      stop_reason: "end_turn",
      content: [
        { type: "web_search_tool_result", tool_use_id: "s1", content: [] },
        { type: "text", text: "TO: office@example.gov\nSUBJECT: Records " },
        { type: "text", text: "request\nBODY:\nHello.\nNOTES: none" },
      ],
    }),
  ]
  const fetchImpl = async (url, opts) => {
    calls.push(JSON.parse(opts.body))
    return replies.shift()
  }
  const text = await draftOutreach({
    apiKey: "k", model: "m", maxTokens: 10, system: "s", fetchImpl,
  })
  assert.match(text, /^TO: office@example.gov/)
  assert.match(text, /Records request/) // spans the two text blocks
  assert.equal(calls.length, 2)
  // The resumed call carries the paused assistant turn back.
  assert.equal(calls[1].messages.length, 2)
  assert.equal(calls[1].messages[1].role, "assistant")
  assert.deepEqual(calls[0].tools, OUTREACH_TOOLS)
})

test("upstream errors and empty drafts throw (claim stays for the next run)", async () => {
  await assert.rejects(
    () => draftOutreach({ apiKey: "k", model: "m", maxTokens: 10, system: "s",
      fetchImpl: async () => ({ ok: false, status: 529 }) }),
    /Anthropic 529/
  )
  await assert.rejects(
    () => draftOutreach({ apiKey: "k", model: "m", maxTokens: 10, system: "s",
      fetchImpl: async () => ok({ stop_reason: "end_turn", content: [] }) }),
    /empty draft/
  )
})

test("a never-finishing pause_turn loop hits the cap instead of spinning", async () => {
  let n = 0
  const fetchImpl = async () => {
    n += 1
    return ok({ stop_reason: "pause_turn", content: [] })
  }
  await assert.rejects(
    () => draftOutreach({ apiKey: "k", model: "m", maxTokens: 10, system: "s", fetchImpl }),
    /loop cap/
  )
  assert.equal(n, 5)
})
