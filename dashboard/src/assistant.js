// The HPS assistant: one home's concierge, 24/7. This module is the pure
// core — it assembles the property's knowledge into context, writes the
// system prompt (persona, scope, action protocol), and parses replies.
//
// Property isolation is structural: the context is built from the signed-in
// member's own property data (which is all the client ever has), and the
// backend's membership check gates the call — there is no other home's
// data anywhere in the loop.
//
// Actions are proposed, never executed, by the model: it embeds
// <action>{...json...}</action> tags which the UI renders as confirm chips.
// The write happens client-side only after the homeowner taps confirm —
// the confirm-then-write contract. New capabilities (e.g. rescheduling)
// are added by extending ACTION_TYPES and the prompt, not by rebuilding.

export const ACTION_TYPES = ["save_fact", "service_request"]

const line = (label, value) => (value ? `${label}: ${value}` : null)

export function buildAssistantContext({
  profile = {},
  systems = [],
  priorities = [],
  calendar = [],
  jobs = [],
  workOrders = [],
  facts = [],
}) {
  const parts = []
  parts.push(
    [
      `PROPERTY: ${profile.address || "unknown address"}${profile.areaLabel ? `, ${profile.areaLabel}` : ""}`,
      line("Client", profile.clientName && `${profile.clientName} family`),
      line("Built", profile.yearBuilt),
      line("Acreage", profile.acreage),
    ]
      .filter(Boolean)
      .join("\n")
  )

  if (systems.length) {
    parts.push(
      "SYSTEMS:\n" +
        systems
          .map((s) =>
            [
              `- ${s.category}${s.detail ? ` (${s.detail})` : ""}`,
              s.brand && `brand: ${s.brand}`,
              s.installYear && `installed: ${s.installYear}`,
              s.condition && `condition: ${s.condition}`,
              s.note && `note: ${s.note}`,
              s.nextDue && `next check due: ${s.nextDue}`,
            ]
              .filter(Boolean)
              .join("; ")
          )
          .join("\n")
    )
  }

  const openPri = priorities.filter((p) => !p.status || p.status === "open" || p.status === "scheduled")
  if (openPri.length) {
    parts.push(
      "OPEN PRIORITIES:\n" +
        openPri.map((p) => `- ${p.title} (${p.urgency || "?"}${p.estCost ? `, est ${p.estCost}` : ""})`).join("\n")
    )
  }

  if (calendar.length) {
    parts.push(
      "CARE CALENDAR:\n" + calendar.map((t) => `- ${t.month || "?"}: ${t.task}`).join("\n")
    )
  }

  if (jobs.length) {
    parts.push(
      "JOB HISTORY (newest last):\n" +
        jobs
          .map((j) => `- ${j.date || "?"}: ${j.title} [${j.status}]${j.cost ? ` ${j.cost}` : ""}${j.sub ? ` — ${j.sub}` : ""}`)
          .join("\n")
    )
  }

  const openWo = workOrders.filter((w) => w.lane !== "done" && w.lane !== "canceled")
  if (openWo.length) {
    parts.push(
      "WORK IN MOTION:\n" +
        openWo
          .map((w) => `- ${w.title} — ${w.lane}${w.scheduledFor ? `, scheduled ${w.scheduledFor}` : ""}`)
          .join("\n")
    )
  }

  if (facts.length) {
    parts.push(
      "LEARNED FACTS (from earlier conversations):\n" +
        facts.map((f) => `- ${f.text}${f.date ? ` (recorded ${f.date})` : ""}`).join("\n")
    )
  }

  return parts.join("\n\n")
}

export function assistantSystemPrompt(context) {
  return `You are the home assistant for Charlottesville Home & Property Services (HPS), a white-glove home management service. You are speaking with a member of the household below. You know THIS home only.

${context}

RULES:
- Answer questions using the home's record above. If the record doesn't say, say so plainly — never invent facts about this home.
- You represent the HPS team (Sally — relationship manager, Paddy & Mike — property owners/operations). You are an assistant, not a human; if the member wants a person, tell them the team is one call away and offer to file a request.
- Do NOT give repair instructions or diagnose safety issues yourself. For anything needing hands, eyes, or judgement at the house, offer to file a service request so the team handles it.
- Keep replies short and warm: 1-3 sentences, plain language, no markdown headers or bullet lists unless listing record items.
- Conversations are shared with the HPS team.

ACTIONS — when appropriate, append action tags on their own lines after your reply text. The member sees each as a button and must confirm; never claim an action is done, only offer it.
1. When the member tells you something new about the home (a replacement, an upgrade, a change), offer to record it:
<action>{"type":"save_fact","fact":"<one clear sentence, past tense, with dates if given>","category":"<matching system category if any, else empty>"}</action>
2. When something needs fixing, checking, or doing, offer to file it:
<action>{"type":"service_request","title":"<short title>","details":"<what the member described, plus any timing/access notes>"}</action>
Use at most one action of each type per reply — EXCEPT when a document is attached: then summarize it in 2-3 sentences and propose up to five save_fact actions for durable facts worth keeping (equipment and models, install/service dates, warranties, costs, contractor names). If a photo is attached, describe what you see briefly and use it to sharpen the fact or request.`
}

// Split a model reply into display text + proposed actions.
export function parseAssistantReply(raw) {
  const actions = []
  const text = (raw || "")
    .replace(/<action>([\s\S]*?)<\/action>/g, (_, json) => {
      try {
        const a = JSON.parse(json.trim())
        if (ACTION_TYPES.includes(a.type)) actions.push({ ...a, status: "pending" })
      } catch {
        /* malformed action: drop it, keep the prose */
      }
      return ""
    })
    .trim()
  return { text, actions }
}

// Transcript-safe copy of a message (images/documents become placeholders
// so the stored conversation stays small and readable).
export function transcriptMessage(m) {
  return {
    role: m.role,
    text: m.text,
    ...(m.hadPhoto ? { hadPhoto: true } : {}),
    ...(m.hadDoc ? { hadDoc: m.hadDoc } : {}),
    ...(m.actions && m.actions.length
      ? { actions: m.actions.map(({ type, fact, title, status }) => ({ type, fact, title, status })) }
      : {}),
  }
}
