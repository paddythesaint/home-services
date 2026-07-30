import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "./useItems"
import { addItem } from "./firestoreApi"
import { todayLabel } from "./dates"
import { isUnderway, isOpenWorkOrder } from "./workOrders"
import { buildRecap } from "./valueRecap"
import { homeFeed } from "./homeFeed"
import { businessRole } from "./roles"
import { designationsFor } from "./designations"
import { TEAM } from "./team"
import {
  Section,
  Row,
  Figure,
  FigureRow,
  AskBar,
  Segmented,
  Detail,
  useViewMode,
  ConditionMeter,
} from "./components"

// The homeowner's Overview, redesign spec section 1 (option 2a): one warm
// surface panel that answers three questions — is my home okay, what's
// happening, how do I reach you — with no operational machinery visible in
// Simple. Detailed is the homeowner's own expansive layer (founder call,
// 7/26): the record in depth, costs included. Operator economics stay
// behind the businessRole gate on top of it.
// The old "Request service" modal is gone; the ask bar is always open.

const visibleToHomeowner = (w) =>
  isUnderway(w) || (w.source === "homeowner" && isOpenWorkOrder(w))

function happeningLabel(w) {
  if (w.lane === "in-progress") return "being worked on"
  if (w.lane === "scheduled")
    return w.scheduledFor ? `scheduled for ${w.scheduledFor}` : "on the calendar"
  return "received — we're arranging it"
}

function happeningRight(w, systems) {
  const attention = systems.some(
    (s) => s.condition !== "good" && w.category && s.category === w.category
  )
  if (attention) return { word: "Attention", tone: "warn" }
  if (w.lane === "scheduled" || w.lane === "in-progress")
    return { word: "Scheduled", tone: "muted" }
  return { word: "Waiting", tone: "muted" }
}

// "June 24, 2026" → "Jun 24" — figure values stay one line at 32px.
function shortDate(label) {
  const t = Date.parse(label || "")
  if (Number.isNaN(t)) return ""
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// The headline's two clauses: the assurance in ink, the caveat de-emphasised.
function headlineFor(systems) {
  if (systems.length === 0)
    return { lead: "We're building your home's record.", clause: "" }
  const urgent = systems.filter((s) => s.condition === "urgent").length
  const attention = systems.filter((s) => s.condition === "attention").length
  if (urgent > 0)
    return {
      lead: "We're on it —",
      clause: ` ${urgent} item${urgent === 1 ? "" : "s"} being handled with priority.`,
    }
  if (attention > 0)
    return {
      lead: "Your home is in good shape.",
      clause: ` ${attention} item${attention === 1 ? "" : "s"} sit${attention === 1 ? "s" : ""} on our watch list.`,
    }
  return { lead: "Your home is in good shape.", clause: "" }
}

export default function HomeownerHome() {
  const { uid, profile, user } = useOutletContext()
  const { mode } = useViewMode()
  const { items: systems } = useItems(uid, "healthReport")
  const { items: workOrders } = useItems(uid, "workOrders")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: visitNotes } = useItems(uid, "visitNotes")
  const { items: priorities } = useItems(uid, "priorityList")
  const { items: nudges } = useItems(uid, "nudges")
  const { items: conversations } = useItems(uid, "conversations")
  const { items: briefs } = useItems(uid, "briefs")
  const latestNote = visitNotes[visitNotes.length - 1]
  const recap = buildRecap({ jobs, priorities })

  const [askText, setAskText] = useState("")
  const [sent, setSent] = useState(false)

  const happening = workOrders.filter(visibleToHomeowner)
  // The acknowledgment stream: care done, emails received (and what was
  // filed from them), briefs sent — so "did you get my email?" is answered
  // by glancing at Home, not by asking.
  const recent = homeFeed({ jobs, conversations, briefs }, 4)

  // Weather nudges: only while the alert is live. Weather is care, not
  // machinery — it shows in Simple too.
  const activeNudges = nudges.filter((n) => !n.endsAt || Date.parse(n.endsAt) > Date.now())

  const headline = headlineFor(systems)
  const counts = systems.reduce((acc, s) => {
    const key = s.condition || "good"
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  // The lede: the latest visit note's first sentence, plus the open item.
  const noteSentence = latestNote
    ? `${(latestNote.body || "").split(/(?<=\.)\s/)[0]}`
    : "Your team keeps this page current after every visit."
  const watching = systems.find((s) => s.condition && s.condition !== "good")
  const lede = watching
    ? `${noteSentence} We're keeping an eye on the ${watching.category.toLowerCase()}.`
    : noteSentence

  // Last-visit figure (founder call, 7/25): the most recent care that
  // actually happened, not a promised future date.
  const lastJob = jobs.filter((j) => j.status === "completed").at(-1)
  const lastVisitValue = lastJob
    ? shortDate(lastJob.date) || lastJob.date || "—"
    : latestNote?.sentOn
      ? shortDate(latestNote.sentOn) || latestNote.sentOn
      : "—"
  const lastVisitLabel = lastJob
    ? `last visit${lastJob.sub ? ` · ${lastJob.sub.split("—")[0].trim()}` : ""}`
    : "last note from your team"

  // The ask bar writes exactly what the old modal wrote.
  async function sendRequest() {
    const text = askText.trim()
    if (!text) return
    await addItem(uid, "workOrders", {
      title: text.split("\n")[0].slice(0, 70),
      notes: text,
      category: "",
      lane: "triage",
      source: "homeowner",
      requestedBy: user?.email || "",
      assigneeType: "",
      contractorId: "",
      contractorName: "",
      quoteStatus: "none",
      quoteAmount: "",
      scheduledFor: "",
      createdOn: todayLabel(),
    })
    setAskText("")
    setSent(true)
  }

  // Everyone gets the depth control — Detailed is the homeowner's expansive
  // view of their own record. Only operator economics stay staff-gated.
  const staff = Boolean(businessRole(user?.email))

  return (
    <div className="bg-surface border border-line-2 rounded-(--radius-panel) shadow-(--shadow-card)">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 px-8 py-4 border-b border-line">
        <p className="eyebrow m-0">{profile.address}</p>
        <Segmented />
      </div>

      <div className="px-5 py-6 md:px-11 md:pt-10 md:pb-9">
        {/* 1 · Headline */}
        <h1 className="font-display m-0 text-[29px] md:text-[44px] leading-[1.1] text-ink">
          {headline.lead}
          {headline.clause && <span className="text-ink-4">{headline.clause}</span>}
        </h1>

        {/* 2 · Lede */}
        <p className="m-0 mt-4 max-w-[620px] text-[14.5px] leading-[1.65] text-ink-2 text-pretty">
          {lede}
        </p>

        {/* 2b · Weather nudges — live alerts turned into what to actually do */}
        {activeNudges.map((n) => (
          <p
            key={n.id}
            className="m-0 mt-4 max-w-[620px] text-[13.5px] leading-[1.6] text-amber-900 bg-amber-50 border border-amber-200 rounded-(--radius-control) px-4 py-3"
          >
            <span className="font-medium">{n.headline}. </span>
            {n.advice}
          </p>
        ))}

        {/* 3 · Condition meter */}
        {systems.length > 0 && (
          <div className="mt-6 max-w-[620px]">
            <ConditionMeter counts={counts} />
          </div>
        )}

        {/* 4 · Figure row — care given, never currency */}
        <div className="mt-9">
          <FigureRow>
            <Figure lead value={recap.tasksDone} label="tasks handled for you" />
            <Figure value={systems.length} label="systems on record" />
            {designationsFor(profile).length > 0 && (
              <Figure value={designationsFor(profile).length} label="trusted pros on call" />
            )}
            <Figure value={lastVisitValue} label={lastVisitLabel} />
          </FigureRow>
        </div>

        {/* 5 · Two-column body */}
        <div className="mt-11 grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-10">
          <div className="flex flex-col gap-9">
            <Section label="In motion" aside={happening.length ? `${happening.length}` : null}>
              {happening.length === 0 ? (
                <p className="m-0 text-[13.5px] text-ink-3 pt-1">
                  Nothing in motion — all quiet.
                </p>
              ) : (
                happening.map((w) => {
                  const right = happeningRight(w, systems)
                  const meta =
                    mode === "detailed"
                      ? [
                          happeningLabel(w),
                          w.contractorName,
                          w.quoteAmount && `quote ${w.quoteAmount}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : happeningLabel(w)
                  return (
                    <Row
                      key={w.id}
                      title={w.title}
                      meta={meta}
                      right={right.word}
                      tone={right.tone}
                    />
                  )
                })
              )}
            </Section>

            <Section label="Recently">
              {recent.length === 0 ? (
                <p className="m-0 text-[13.5px] text-ink-3 pt-1">
                  Care will show here as it happens.
                </p>
              ) : (
                recent.map((e, i) => (
                  <Row
                    key={`${e.kind}-${i}`}
                    title={e.title}
                    meta={[e.when, e.detail, mode === "detailed" && e.cost]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))
              )}
            </Section>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-sunk rounded-(--radius-block) p-5" data-tour="team">
              <p className="eyebrow m-0 mb-3.5">Your team</p>
              <ul className="m-0 p-0 list-none flex flex-col gap-3">
                {TEAM.map((t) => (
                  <li key={t.name}>
                    <p className="m-0 text-sm font-medium text-ink">{t.name}</p>
                    <p className="m-0 text-[12.5px] text-ink-3">{t.title}</p>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3.5 pt-3.5 border-t border-line-2 text-[12.5px] text-ink-3">
                {latestNote?.sentOn
                  ? `Last note from your team · ${latestNote.sentOn}`
                  : "Anything urgent, call or text — we see it right away."}
              </p>
              <Link
                to="/emergency"
                className="mt-3 inline-block text-[13px] font-medium text-status-critical hover:underline"
              >
                Emergency info — shutoffs &amp; who to call &rarr;
              </Link>
            </div>

            <Section label="Membership">
              <p className="m-0 text-sm text-ink">{profile.tier || "Member"} plan</p>
              <p className="m-0 mt-1 text-[12.5px] text-ink-3">
                {profile.nextInvoiceDate
                  ? `Nothing due — next statement ${profile.nextInvoiceDate}`
                  : "Nothing due"}
              </p>
            </Section>
          </div>
        </div>

        {/* 6 · The record in depth — the homeowner's own expansive layer.
            Every system with its dates and state, straight from the record. */}
        <Detail>
          <div className="mt-10 bg-[#F3F1E9] rounded-(--radius-block) px-7 py-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="eyebrow m-0">The record in depth</p>
              <span className="numeric text-[11px] text-ink-3">
                {systems.length} systems · {jobs.length} jobs logged
              </span>
            </div>

            {/* Edge fade on phones: the table scrolls sideways — say so. */}
            <div className="mt-4 overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
              <div className="grid grid-cols-[1.6fr_1fr_1fr_.8fr] min-w-[520px]">
                {["System", "Installed", "Last serviced", "State"].map((h) => (
                  <span key={h} className="text-[10.5px] uppercase tracking-wide text-[#9A9C8E] pb-1.5">
                    {h}
                  </span>
                ))}
                {systems.map((s) => (
                  <RowCells
                    key={s.id}
                    cells={[
                      s.category,
                      s.installYear || "—",
                      s.lastServiced || "—",
                      <span key="state" className="inline-flex items-center gap-1.5">
                        <span
                          className="w-[7px] h-[7px] rounded-full"
                          style={{
                            background:
                              s.condition === "urgent"
                                ? "var(--color-status-critical)"
                                : s.condition === "attention"
                                  ? "var(--color-status-warn)"
                                  : "var(--color-status-good)",
                          }}
                          aria-hidden="true"
                        />
                        {s.condition || "good"}
                      </span>,
                    ]}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Operator band — economics; never reaches a homeowner even in
              Detailed. businessRole gates it on top of the depth toggle. */}
          {staff && (
            <div className="mt-5 bg-[#F3F1E9] rounded-(--radius-block) px-7 py-6">
              <div className="flex items-baseline justify-between gap-4">
                <p className="eyebrow m-0">Operator view · not shown to the homeowner</p>
                <span className="numeric text-[11px] text-ink-3">
                  {workOrders.length} order{workOrders.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
                <div className="grid grid-cols-[1.5fr_1fr_.8fr_.7fr_.7fr] min-w-[560px]">
                  {["Order", "Pro", "Quote", "Margin", "Lane"].map((h) => (
                    <span key={h} className="text-[10.5px] uppercase tracking-wide text-[#9A9C8E] pb-1.5">
                      {h}
                    </span>
                  ))}
                  {workOrders
                    .filter((w) => w.lane !== "done" && w.lane !== "canceled")
                    .map((w) => (
                      <RowCells
                        key={w.id}
                        cells={[
                          w.title,
                          w.contractorName || "—",
                          w.quoteAmount || "—",
                          "—",
                          w.lane,
                        ]}
                      />
                    ))}
                </div>
              </div>
            </div>
          )}
        </Detail>

        {/* 7 · Ask bar — replaces the Request service modal */}
        <div className="mt-10" data-tour="request">
          <AskBar
            value={askText}
            onChange={setAskText}
            onSend={sendRequest}
            hint={`${TEAM.map((t) => t.name).join(" and ")} read these directly. Anything urgent, call or text — we see it right away.`}
          />
          {sent && (
            <p className="m-0 mt-3 text-[13px] font-medium text-brand-700">
              Received — you'll see it above under "In motion" while we arrange it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// One body row of an operator-band table: shared top hairline, 9px rhythm.
function RowCells({ cells }) {
  return (
    <>
      {cells.map((c, i) => (
        <span
          key={i}
          className="text-[12.5px] text-ink-2 py-[9px] border-t border-[#E4E0D4] pr-3 truncate"
        >
          {c}
        </span>
      ))}
    </>
  )
}
