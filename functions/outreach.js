// The background outreach drafter's core: run one drafting conversation
// against the Anthropic API with the web-search server tool, resuming
// paused turns (a searching turn can stop with "pause_turn" partway)
// until the model finishes, then return every text block joined — a
// searching turn interleaves several text blocks with its search-result
// blocks, so taking only the first would truncate the draft.
//
// Pure I/O-through-fetch so it unit-tests without the network; the
// scheduled sweep in index.js owns Firestore.

const OUTREACH_TOOLS = [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]

async function draftOutreach({ apiKey, model, maxTokens, system, fetchImpl = fetch }) {
  let messages = [{ role: "user", content: "Draft the outreach email for this work order." }]
  for (let turn = 0; turn < 5; turn++) {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        tools: OUTREACH_TOOLS,
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const data = await res.json()
    if (data.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: data.content }]
      continue
    }
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
    if (!text) throw new Error("empty draft")
    return text
  }
  throw new Error("draft did not finish (pause_turn loop cap)")
}

module.exports = { draftOutreach, OUTREACH_TOOLS }
