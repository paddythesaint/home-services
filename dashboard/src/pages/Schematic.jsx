import { useEffect, useMemo, useRef, useState } from "react"
import { PageHeader } from "../components"

// The system map, in-app: a boxes-and-wires view of how a home's data becomes
// intelligence. Four bands top-to-bottom — Data In → Stores → Engines →
// Surfaces. Click any box to trace what it pulls from and feeds into; the
// wires are drawn on demand so 40+ boxes don't turn into a hairball. Ported
// from the standalone schematic so founders and staff can open it here rather
// than jumping to an external page. Styling is scoped under `.smap`.

const BANDS = [
  { id: "in", idx: "01", title: "Data In", sub: "How information enters the record", flow: "Sources" },
  { id: "store", idx: "02", title: "Data Stores", sub: "Per-property records (Firestore)", flow: "Pulled by ↓" },
  { id: "engine", idx: "03", title: "Intelligence Engines", sub: "Stateless logic — home-agnostic, replicates to every home", flow: "Reads ↑ · feeds ↓" },
  { id: "surface", idx: "04", title: "Surfaces", sub: "Where it shows up in the app", flow: "Rendered pages" },
]

const NODES = [
  // Band 1 — Data In
  { id: "walkthrough", band: "in", title: "Guided Walkthrough", tech: "Walkthrough.jsx", desc: "In-person survey that confirms each system and captures what's missing.", fields: ["verify systems", "add priorities"], feeds: ["health", "priorities"] },
  { id: "import", band: "in", title: "Document & Records Import", tech: "documentInsights · recordsIndex · serviceRecords · energyAudit", desc: "One-click waves from closing docs, inspection, energy audit, and the Gmail sweep.", fields: ["closing pkg", "inspection", "Gmail sweep"], feeds: ["health", "jobs", "priorities", "warranties", "media"] },
  { id: "assistantIn", band: "in", title: "AI Assistant — actions", tech: "assistant.js · save_fact / service_request / log_job", desc: "Chat that, on confirmation, writes to the record. Reads and writes are separated.", fields: ["save fact", "log job", "raise request"], feeds: ["facts", "workorders", "jobs", "log"] },
  { id: "request", band: "in", title: "Homeowner Request", tech: "Request button", desc: "The client's own words become a tracked ticket.", fields: ["verbatim ask"], feeds: ["workorders"] },
  { id: "visit", band: "in", title: "Contractor Visit & Job Log", tech: "Job History entry", desc: "Completed work — who, what, cost — logged to the record.", fields: ["vendor", "cost", "notes"], feeds: ["jobs", "workorders"] },
  { id: "seed", band: "in", title: "Public-Records Seed & Nameplate OCR", tech: "seedData.js · nameplateVision.js", desc: "Starter profile from public data; Claude reads nameplate photos for brand/age.", fields: ["public records", "photo OCR"], feeds: ["profile", "health", "media"] },
  { id: "email", band: "in", title: "Email Forwarding", tech: "designed — onboarding path", desc: "Forwarded service emails parsed into the record. Planned, not yet built.", fields: ["planned"], feeds: ["jobs", "health", "warranties"] },

  // Band 2 — Data Stores
  { id: "profile", band: "store", title: "Property Profile", tech: "property doc", desc: "The home itself and who can see it.", fields: ["address", "ZIP / area", "tier", "year built", "acreage", "members"] },
  { id: "health", band: "store", title: "Systems & Health", tech: "healthReport", desc: "Every tracked system and its condition.", fields: ["category", "condition", "install year", "verified", "next due", "brand / model"] },
  { id: "jobs", band: "store", title: "Job History", tech: "jobHistory", desc: "Every job ever dispatched on the home.", fields: ["date", "title", "category", "vendor", "cost", "status"] },
  { id: "priorities", band: "store", title: "90-Day Priorities", tech: "priorityList", desc: "Ranked recommendations and how each gets closed.", fields: ["urgency", "resolutionPath", "materials", "workOrderId", "seasonalId"] },
  { id: "workorders", band: "store", title: "Work Orders", tech: "workOrders", desc: "Work from “we should” to “done, on the record.”", fields: ["lane", "assignee", "quote", "priorityIds", "bundleKey", "aiSummary"] },
  { id: "warranties", band: "store", title: "Coverage & Warranties", tech: "warranties", desc: "Warranties, plans, and service contracts with expiries.", fields: ["item", "type", "provider", "start", "expiry"] },
  { id: "calendar", band: "store", title: "Care Calendar", tech: "careCalendar", desc: "Recurring, scheduled home care.", fields: ["task", "cadence", "next due", "last done"] },
  { id: "contractors", band: "store", title: "Contractor Network", tech: "contractors", desc: "One entry per vendor, structured by home and job.", fields: ["name", "trades", "phone", "sourcing", "jobs by home"] },
  { id: "media", band: "store", title: "Photos · Documents · Facts", tech: "photos / documents / facts", desc: "Nameplate photos, uploaded files, and saved facts.", fields: ["nameplate photos", "uploads", "saved facts"] },
  { id: "log", band: "store", title: "Activity & Transcripts", tech: "activity / transcripts", desc: "The change log and assistant history (delete-locked).", fields: ["change log", "assistant chat", "append-only"] },

  // Band 3 — Intelligence Engines
  { id: "benchmarks", band: "engine", title: "Lifespan & Cost Benchmarks", tech: "benchmarks.js", desc: "Typical life and replacement cost per system type; where each sits against its life.", fields: ["lifespans", "replace cost", "horizon"], pulls: ["health"], feeds: ["s_health", "s_forecast"] },
  { id: "forecast", band: "engine", title: "Cost Forecast", tech: "forecast.js", desc: "3-year planning ranges from system age and open priorities.", fields: ["3-yr ranges"], pulls: ["health", "priorities"], feeds: ["s_forecast"] },
  { id: "trades", band: "engine", title: "Trade Taxonomy", tech: "trades.js", desc: "Maps free-text categories onto stable trades so everything groups the same way.", fields: ["classifier", "grouping"], pulls: ["health", "jobs", "priorities"], feeds: ["s_health", "s_jobs", "s_priorities", "s_report"] },
  { id: "issue", band: "engine", title: "Issue Intelligence", tech: "issuePlaybook.js", desc: "Clusters related priorities into a root issue, shows escalation cost, and bundles the fix.", fields: ["clusters", "escalation", "bundle → WO"], pulls: ["priorities"], feeds: ["s_priorities", "s_ops", "s_workorders"] },
  { id: "resolution", band: "engine", title: "Readiness & Visit Planning", tech: "resolution.js · requirementSuggestions.js", desc: "What each priority still needs, the next-visit manifest, and quote packages.", fields: ["readiness", "manifest", "quote bundles"], pulls: ["priorities"], feeds: ["s_priorities"] },
  { id: "coverage", band: "engine", title: "Coverage Intelligence", tech: "warranties.js", desc: "Flags coverage that's expiring or already lapsed, soonest first.", fields: ["status", "expiry alerts"], pulls: ["warranties"], feeds: ["s_coverage", "s_ops", "s_report"] },
  { id: "spend", band: "engine", title: "Spend Intelligence", tech: "spendInsights.js", desc: "Reads job costs into an annual story — by trade, month, and vendor.", fields: ["by trade", "by month", "by vendor"], pulls: ["jobs", "health", "warranties"], feeds: ["s_report"] },
  { id: "maint", band: "engine", title: "Recurrence & Seasonal", tech: "maintenanceIntelligence.js · climate.js", desc: "Flags systems that keep recurring, and a seasonal checklist tuned to the home's ZIP.", fields: ["recurrence", "aging", "ZIP → climate"], pulls: ["jobs", "profile"], feeds: ["s_next"] },
  { id: "jobshape", band: "engine", title: "Job History Shaping", tech: "jobHistoryView.js", desc: "Sorts by real activity date; builds the month timeline and per-system rollup.", fields: ["date parse", "timeline", "rollup"], pulls: ["jobs"], feeds: ["s_jobs"] },
  { id: "match", band: "engine", title: "Contractor Matching", tech: "contractorMatching.js", desc: "Canonicalizes vendor names to dedupe the network and merge spend.", fields: ["canonical name", "dedupe", "merge"], pulls: ["contractors", "jobs"], feeds: ["s_network", "s_report"] },
  { id: "quote", band: "engine", title: "Quote Request Builder", tech: "quoteRequest.js", desc: "Suggests trade-matched contractors and drafts a combined quote email across related work.", fields: ["trade match", "combine", "email pack"], pulls: ["workorders", "priorities", "contractors", "profile"], feeds: ["s_workorders"] },
  { id: "briefing", band: "engine", title: "Work-Order AI Briefing", tech: "workOrderBriefing.js + Cloud Function", desc: "Reads the home's record to brief the ops lead before dispatch.", fields: ["likely cause", "history", "right trade"], pulls: ["health", "priorities", "jobs", "media", "profile"], feeds: ["s_workorders"] },
  { id: "aibrain", band: "engine", title: "AI Assistant — brain", tech: "assistant.js + Cloud Function → Claude", desc: "Answers over the whole record, scoped to one home, with record-gap prompts.", fields: ["full context", "scoped", "record gaps"], pulls: ["profile", "health", "jobs", "priorities", "warranties", "media"], feeds: ["s_assistant"] },

  // Band 4 — Surfaces
  { id: "s_overview", band: "surface", title: "Overview", tech: "Home", desc: "The calm home screen — what's happening now.", fields: ["homeowner"], reads: ["profile", "health", "priorities", "workorders"] },
  { id: "s_health", band: "surface", title: "Systems & Health", tech: "Record", desc: "Every system by trade, with condition and horizons.", fields: ["homeowner"], reads: ["health"] },
  { id: "s_jobs", band: "surface", title: "Job History", tech: "Record", desc: "Timeline and by-system rollup of all work.", fields: ["homeowner"], reads: ["jobs"] },
  { id: "s_coverage", band: "surface", title: "Coverage", tech: "Record", desc: "The warranty & plan ledger with expiry alerts.", fields: ["homeowner"], reads: ["warranties"] },
  { id: "s_contractors", band: "surface", title: "Contractors", tech: "Record", desc: "The home's vendors.", fields: ["homeowner"], reads: ["contractors"] },
  { id: "s_next", band: "surface", title: "What's Next", tech: "Plan", desc: "In-flight work, this month's care, recurrence flags, seasonal checklist.", fields: ["homeowner"], reads: ["calendar", "priorities", "workorders"] },
  { id: "s_calendar", band: "surface", title: "Care Calendar", tech: "Plan", desc: "Recurring care across the year.", fields: ["homeowner"], reads: ["calendar"] },
  { id: "s_priorities", band: "surface", title: "90-Day Priorities", tech: "Plan", desc: "Ranked list with readiness, urgency filter, and issue bundling.", fields: ["homeowner"], reads: ["priorities"] },
  { id: "s_forecast", band: "surface", title: "Cost Forecast", tech: "Plan", desc: "3-year outlook by system.", fields: ["homeowner"], reads: ["health"] },
  { id: "s_report", band: "surface", title: "Year in Review", tech: "Plan", desc: "Annual spend, care, and coverage in one report.", fields: ["homeowner"], reads: ["jobs"] },
  { id: "s_assistant", band: "surface", title: "Assistant", tech: "chat", desc: "Native chat over the home's record.", fields: ["homeowner"], reads: ["log"] },
  { id: "s_ops", band: "surface", title: "Command Center", tech: "Ops · founder", desc: "Portfolio health, attention feed, escalation & coverage risk.", fields: ["founder"], reads: ["profile", "health", "priorities"] },
  { id: "s_workorders", band: "surface", title: "Work Orders", tech: "board · founder", desc: "Every ticket across the portfolio, with AI briefing & quote requests.", fields: ["founder"], reads: ["workorders"] },
  { id: "s_network", band: "surface", title: "Contractor Network", tech: "founder", desc: "The vendor network with dedupe & merge.", fields: ["founder"], reads: ["contractors"] },
]

const BAND_LINE = { in: "#c08a3c", store: "#5a89ab", engine: "#3f8461", surface: "#b46a44" }

// Build byId + undirected adjacency + a flat edge list, both ways.
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))
const adj = Object.fromEntries(NODES.map((n) => [n.id, {}]))
const edges = []
for (const n of NODES) {
  for (const t of [...(n.feeds || []), ...(n.pulls || []), ...(n.reads || [])]) {
    if (byId[t] && !adj[n.id][t]) {
      adj[n.id][t] = true
      adj[t][n.id] = true
      edges.push([n.id, t])
    }
  }
}

function connectionNote(id) {
  const n = byId[id]
  const label = (x) => byId[x].title.replace(/&amp;/g, "&")
  let pulls = [...(n.pulls || []), ...(n.reads || [])].map(label)
  let feeds = (n.feeds || []).map(label)
  if (!pulls.length && !feeds.length) {
    for (const nb of Object.keys(adj[id])) {
      const m = byId[nb]
      if (m.band === "in") pulls.push(`${label(nb)} (fills)`)
      else if (m.band === "engine" || m.band === "surface") feeds.push(label(nb))
      else pulls.push(label(nb))
    }
  }
  const parts = []
  if (pulls.length) parts.push(`↑ pulls from: ${pulls.join(", ")}`)
  if (feeds.length) parts.push(`↓ feeds: ${feeds.join(", ")}`)
  return parts.join("   ·   ")
}

export default function Schematic() {
  const [active, setActive] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const diagramRef = useRef(null)
  const svgRef = useRef(null)

  const neighbors = useMemo(() => (active ? new Set(Object.keys(adj[active])) : null), [active])

  useEffect(() => {
    const svg = svgRef.current
    const diagram = diagramRef.current
    if (!svg || !diagram) return

    function centers(id) {
      const el = diagram.querySelector(`#smap-${id}`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const d = diagram.getBoundingClientRect()
      return {
        x: r.left - d.left + r.width / 2,
        top: r.top - d.top,
        bottom: r.top - d.top + r.height,
        mid: r.top - d.top + r.height / 2,
      }
    }
    function edge(a, b, color, opacity, width) {
      const ca = centers(a)
      const cb = centers(b)
      if (!ca || !cb) return
      const y1 = ca.mid < cb.mid ? ca.bottom : ca.top
      const y2 = ca.mid < cb.mid ? cb.top : cb.bottom
      const my = (y1 + y2) / 2
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path")
      p.setAttribute("d", `M ${ca.x} ${y1} C ${ca.x} ${my}, ${cb.x} ${my}, ${cb.x} ${y2}`)
      p.setAttribute("fill", "none")
      p.setAttribute("stroke", color)
      p.setAttribute("stroke-width", width)
      p.setAttribute("stroke-linecap", "round")
      p.setAttribute("opacity", opacity)
      svg.appendChild(p)
    }
    function draw() {
      svg.setAttribute("viewBox", `0 0 ${diagram.clientWidth} ${diagram.clientHeight}`)
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      if (showAll) {
        for (const [a, b] of edges) edge(a, b, BAND_LINE[byId[a].band], 0.22, 1.1)
      } else if (active) {
        for (const nb of Object.keys(adj[active])) {
          edge(active, nb, BAND_LINE[byId[active].band], 0.7, 2)
        }
      }
    }
    draw()
    window.addEventListener("resize", draw)
    return () => window.removeEventListener("resize", draw)
  }, [active, showAll, neighbors])

  function pick(id) {
    setShowAll(false)
    setActive((cur) => (cur === id ? null : id))
  }

  return (
    <div className="smap">
      <SmapStyles />
      <PageHeader
        title="System Map"
        subtitle="How a home's data becomes intelligence: raw information comes in, lands in a store, is read by an intelligence engine, and surfaces on a page. Click any box to trace what it pulls from and feeds into."
      />

      <div className="smap-toolbar">
        <div className="smap-legend">
          <span className="smap-li"><span className="smap-sw" data-b="in" />Data In</span>
          <span className="smap-li"><span className="smap-sw" data-b="store" />Data Stores</span>
          <span className="smap-li"><span className="smap-sw" data-b="engine" />Intelligence Engines</span>
          <span className="smap-li"><span className="smap-sw" data-b="surface" />Surfaces</span>
        </div>
        <span className="smap-spacer" />
        <button
          type="button"
          className="smap-btn"
          aria-pressed={showAll}
          onClick={() => { setShowAll((s) => !s); setActive(null) }}
        >
          {showAll ? "Hide connections" : "Show all connections"}
        </button>
        <button
          type="button"
          className="smap-btn"
          onClick={() => { setActive(null); setShowAll(false) }}
        >
          Reset
        </button>
        <span className="smap-hint">
          {active ? "Showing one box's wires — click it again, or Reset" : "Click a box to trace its wires"}
        </span>
      </div>

      <div className="smap-diagram" ref={diagramRef}>
        <svg className="smap-wires" ref={svgRef} aria-hidden="true" />
        <div className="smap-bands">
          {BANDS.map((b) => (
            <section className="smap-band" data-band={b.id} key={b.id}>
              <div className="smap-band-head">
                <span className="smap-band-idx">{b.idx}</span>
                <span className="smap-band-title">{b.title}</span>
                <span className="smap-band-sub">{b.sub}</span>
                <span className="smap-band-flow">{b.flow}</span>
              </div>
              <div className="smap-grid">
                {NODES.filter((n) => n.band === b.id).map((n) => {
                  const state =
                    !active || showAll
                      ? ""
                      : n.id === active
                        ? "active"
                        : neighbors.has(n.id)
                          ? "linked"
                          : "dim"
                  return (
                    <button
                      type="button"
                      key={n.id}
                      id={`smap-${n.id}`}
                      className={`smap-node ${state}`}
                      data-band={n.band}
                      onClick={() => pick(n.id)}
                    >
                      <p className="smap-node-title">{n.title}</p>
                      <p className="smap-node-tech">{n.tech}</p>
                      <p className="smap-node-desc">{n.desc}</p>
                      <div className="smap-fields">
                        {n.fields.map((f) => (
                          <span className="smap-field" key={f}>{f}</span>
                        ))}
                      </div>
                      {n.id === active && !showAll && (
                        <p className="smap-conn">{connectionNote(n.id)}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <p className="smap-foot">
        Blue <b>stores</b> hold each property's own records (scoped per home). Green <b>engines</b>{" "}
        are stateless modules that run identically on any home — 895 Old Ballard is just the first
        one populated, so every new home inherits the whole system as its records fill in.
      </p>
    </div>
  )
}

function SmapStyles() {
  return (
    <style>{`
      .smap { --in:#a9691c; --in-bg:#f6ecdb; --store:#3a6788; --store-bg:#e6eef4;
        --engine:#2f6b4f; --engine-bg:#e0eee6; --surface:#a4512f; --surface-bg:#f5e6dc;
        --ink:#1a241e; --muted:#5d6b61; --faint:#8a978c; --line:#ddd8ca; --panel:#fffdf8;
        --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .smap-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px;
        padding:10px 12px; background:var(--panel); border:1px solid var(--line);
        border-radius:12px; margin-bottom:16px; }
      .smap-legend { display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; }
      .smap-li { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--muted); font-weight:500; }
      .smap-sw { width:11px; height:11px; border-radius:3px; }
      .smap-sw[data-b=in]{ background:var(--in);} .smap-sw[data-b=store]{ background:var(--store);}
      .smap-sw[data-b=engine]{ background:var(--engine);} .smap-sw[data-b=surface]{ background:var(--surface);}
      .smap-spacer { flex:1 1 auto; }
      .smap-hint { font-family:var(--mono); font-size:11px; color:var(--faint); }
      .smap-btn { font: inherit; font-size:13px; font-weight:600; color:var(--ink);
        background:transparent; border:1px solid var(--line); border-radius:8px; padding:6px 11px; cursor:pointer; }
      .smap-btn:hover { border-color:var(--engine); }
      .smap-btn[aria-pressed=true] { background:var(--engine); color:#fff; border-color:var(--engine); }
      .smap-diagram { position:relative; }
      .smap-wires { position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; overflow:visible; }
      .smap-bands { position:relative; z-index:1; display:flex; flex-direction:column; gap:18px; }
      .smap-band { position:relative; border:1px solid var(--line); border-radius:16px; padding:12px; }
      .smap-band[data-band=in]{ --band:var(--in); background:color-mix(in srgb, var(--in) 4%, var(--panel)); }
      .smap-band[data-band=store]{ --band:var(--store); background:color-mix(in srgb, var(--store) 4%, var(--panel)); }
      .smap-band[data-band=engine]{ --band:var(--engine); background:color-mix(in srgb, var(--engine) 4%, var(--panel)); }
      .smap-band[data-band=surface]{ --band:var(--surface); background:color-mix(in srgb, var(--surface) 4%, var(--panel)); }
      .smap-band::before { content:""; position:absolute; left:0; top:14px; bottom:14px; width:4px; border-radius:0 4px 4px 0; background:var(--band); }
      .smap-band-head { display:flex; align-items:baseline; gap:10px; padding:2px 4px 10px 12px; flex-wrap:wrap; }
      .smap-band-idx { font-family:var(--mono); font-size:12px; font-weight:700; color:var(--band); letter-spacing:.1em; }
      .smap-band-title { font-size:15px; font-weight:680; }
      .smap-band-sub { font-size:12.5px; color:var(--muted); }
      .smap-band-flow { margin-left:auto; font-family:var(--mono); font-size:11px; color:var(--faint); text-transform:uppercase; letter-spacing:.04em; }
      .smap-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:10px; padding:0 4px; }
      .smap-node { position:relative; text-align:left; cursor:pointer; background:var(--panel);
        border:1px solid var(--line); border-left:3px solid var(--band); border-radius:10px;
        padding:11px 12px 12px; color:inherit; font:inherit; width:100%;
        transition:transform .15s, box-shadow .15s, opacity .15s; box-shadow:0 1px 2px rgba(26,36,30,.05); }
      .smap-node[data-band=in]{ --band:var(--in);} .smap-node[data-band=store]{ --band:var(--store);}
      .smap-node[data-band=engine]{ --band:var(--engine);} .smap-node[data-band=surface]{ --band:var(--surface);}
      .smap-node:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(26,36,30,.12); }
      .smap-node:focus-visible { outline:2px solid var(--band); outline-offset:2px; }
      .smap-node.dim { opacity:.32; }
      .smap-node.active { z-index:3; outline:2px solid var(--band); box-shadow:0 8px 22px rgba(26,36,30,.16); }
      .smap-node.linked { z-index:2; box-shadow:0 8px 22px rgba(26,36,30,.13); }
      .smap-node-title { font-size:14px; font-weight:660; margin:0 0 3px; line-height:1.25; }
      .smap-node-tech { font-family:var(--mono); font-size:11px; color:var(--band); margin:0 0 7px; word-break:break-word; }
      .smap-node-desc { font-size:12px; color:var(--muted); margin:0 0 9px; line-height:1.4; }
      .smap-fields { display:flex; flex-wrap:wrap; gap:4px; }
      .smap-field { font-family:var(--mono); font-size:10px; color:var(--band);
        background:color-mix(in srgb, var(--band) 12%, transparent); border-radius:4px; padding:1.5px 5px; line-height:1.5; }
      .smap-conn { margin:8px 0 0; font-size:11px; color:var(--faint); line-height:1.5; }
      .smap-foot { max-width:70ch; margin:18px auto 0; font-size:12.5px; color:var(--muted); line-height:1.55; text-align:center; }
      @media (max-width:560px){ .smap-band-flow{ display:none; } .smap-grid{ grid-template-columns:1fr 1fr; } }
      @media (prefers-reduced-motion: reduce){ .smap-node{ transition:none; } .smap-node:hover{ transform:none; } }
    `}</style>
  )
}
