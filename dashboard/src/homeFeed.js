// The Home newsfeed: one merged "what has happened lately" stream composed
// from data the record already holds — completed jobs, emails received and
// what was filed from them, and weekly briefs sent. Nothing new is stored;
// this is pure shaping, so the acknowledgment the founder asked for ("show
// me what was received and ingested") costs no new writes and no new page.

const when = (label) => {
  const t = Date.parse(label || "")
  return Number.isNaN(t) ? 0 : t
}

// One line describing what an intake conversation did with its email.
function intakeSummary(conv) {
  let auto = 0
  let pending = 0
  for (const m of conv.messages || []) {
    for (const a of m.actions || []) {
      if (a.auto || a.status === "done") auto += 1
      else if (a.status === "pending") pending += 1
    }
  }
  const parts = []
  if (auto) parts.push(`${auto} entr${auto === 1 ? "y" : "ies"} filed to the record`)
  if (pending) parts.push(`${pending} awaiting your OK`)
  return parts.join(" · ") || "read and archived"
}

export function homeFeed({ jobs = [], conversations = [], briefs = [] }, limit = 8) {
  const entries = []

  for (const j of jobs) {
    if ((j.status || "completed") !== "completed") continue
    entries.push({
      kind: "job",
      order: when(j.date),
      when: j.date || "",
      title: j.title,
      detail: j.sub || "",
      cost: j.cost || "", // shown only where Detailed mode asks for it
    })
  }

  for (const c of conversations) {
    if (c.source !== "email-intake") continue
    entries.push({
      kind: "email",
      order: c.order || when(c.startedOn),
      when: c.startedOn || "",
      title: (c.summary || "Email received").replace(/^Email intake: /, "Received: "),
      detail: intakeSummary(c),
    })
  }

  for (const b of briefs) {
    entries.push({
      kind: "brief",
      order: b.order || when(b.createdOn),
      when: b.createdOn || "",
      title: "Weekly brief sent",
      detail: (b.sentTo || []).length ? `to ${(b.sentTo || []).length} member${(b.sentTo || []).length === 1 ? "" : "s"}` : "",
    })
  }

  return entries.sort((a, b) => b.order - a.order).slice(0, limit)
}

export const FEED_KIND_LABEL = {
  job: "Work done",
  email: "Email in",
  brief: "Brief",
}
