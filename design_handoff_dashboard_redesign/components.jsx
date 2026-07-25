import { createContext, useContext, useState } from "react"
import { Link } from "react-router-dom"

/* Redesigned primitives. Same export names as the old components.jsx so
   existing pages keep compiling; the look changes underneath. New primitives
   at the bottom (Section, Row, Figure, FigureRow, Segmented, Detail, AskBar)
   are what pages should migrate to — they replace stacked <Card> grids with
   hairline-ruled sections. */

/* ---------- view mode: Simple (homeowner) vs Detailed (operator) ---------- */

const ViewMode = createContext({ mode: "simple", setMode: () => {} })

export function ViewModeProvider({ children, initial = "simple" }) {
  const [mode, setMode] = useState(initial)
  return <ViewMode.Provider value={{ mode, setMode }}>{children}</ViewMode.Provider>
}

export const useViewMode = () => useContext(ViewMode)

/** Wrap anything that must never reach a homeowner: costs, margins, lanes,
    contractor economics. Renders only in Detailed. */
export function Detail({ children }) {
  return useViewMode().mode === "detailed" ? children : null
}

export function Segmented({ onPhoto = false }) {
  const { mode, setMode } = useViewMode()
  const track = onPhoto
    ? "flex p-0.5 rounded-full bg-white/20 backdrop-blur-sm"
    : "flex p-0.5 rounded-full bg-[#f0ede4]"
  const seg = (active) => {
    const base = "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
    if (onPhoto)
      return `${base} ${active ? "bg-surface text-ink" : "text-white/80"}`
    return `${base} ${active ? "bg-white text-ink shadow-(--shadow-pill)" : "text-ink-3"}`
  }
  return (
    <div className={track} role="group" aria-label="Level of detail">
      <button type="button" className={seg(mode === "simple")} onClick={() => setMode("simple")}>
        Simple
      </button>
      <button type="button" className={seg(mode === "detailed")} onClick={() => setMode("detailed")}>
        Detailed
      </button>
    </div>
  )
}

/* ---------- structure ---------- */

/** A titled band of content separated by rules, not a floating card.
    Use this instead of <Card> for everything on a page surface. */
export function Section({ label, aside, children, className = "" }) {
  return (
    <section className={className}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-4">
          {label && <p className="eyebrow m-0">{label}</p>}
          {aside && <span className="text-xs text-ink-3">{aside}</span>}
        </div>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  )
}

/** One hairline-ruled list row. `meta` is the muted second line, `right` the
    status word. Rows share a top border; the list closes itself. */
export function Row({ title, meta, right, tone = "muted", to }) {
  const toneClass = {
    muted: "text-ink-2",
    warn: "text-status-warn",
    critical: "text-status-critical",
  }[tone]
  const body = (
    <div className="flex justify-between gap-5 py-3.5 border-t border-line last:border-b">
      <div>
        <p className="m-0 text-[14.5px] font-medium text-ink">{title}</p>
        {meta && <p className="m-0 mt-0.5 text-[12.5px] text-ink-3">{meta}</p>}
      </div>
      {right && <span className={`text-[12.5px] whitespace-nowrap pt-0.5 ${toneClass}`}>{right}</span>}
    </div>
  )
  return to ? <Link to={to} className="block hover:bg-ink/[0.02]">{body}</Link> : body
}

/** A single figure. First one in a row gets `lead` for the ink-weight rule. */
export function Figure({ value, label, lead = false }) {
  return (
    <div className={`pt-3 border-t ${lead ? "border-rule" : "border-line-2"}`}>
      <p className="font-display m-0 text-[32px] leading-none text-ink whitespace-nowrap">{value}</p>
      <p className="m-0 mt-1.5 text-xs text-ink-3">{label}</p>
    </div>
  )
}

export function FigureRow({ children, cols = 4 }) {
  return <div className={`grid grid-cols-2 md:grid-cols-${cols} gap-x-7 gap-y-5`}>{children}</div>
}

/** The always-open request field. Replaces the "Request service" modal —
    a homeowner should never meet a dialog to ask for help. */
export function AskBar({ value, onChange, onSend, hint }) {
  return (
    <div>
      <div className="flex items-center gap-3.5 pl-5 p-2 bg-field border border-line-2 rounded-2xl">
        <span className="w-2 h-2 rounded-full bg-status-good shrink-0" aria-hidden="true" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Something need attention? Tell Sally — she reads these directly."
          className="flex-1 bg-transparent text-[14.5px] text-ink placeholder:text-ink-4 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          className="bg-brand-700 text-surface rounded-(--radius-control) px-5 py-2.5 text-[13.5px] font-medium hover:bg-brand-900"
        >
          Send
        </button>
      </div>
      {hint && <p className="m-0 mt-3 ml-0.5 text-xs text-ink-4">{hint}</p>}
    </div>
  )
}

/* ---------- status ---------- */

export const CONDITION_META = {
  good: { label: "Good", color: "var(--color-status-good)" },
  attention: { label: "Attention", color: "var(--color-status-warn)" },
  urgent: { label: "Urgent", color: "var(--color-status-critical)" },
}

function StatusChip({ color, children }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-[12.5px] text-ink-2 whitespace-nowrap">
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  )
}

export function ConditionBadge({ condition }) {
  const meta = CONDITION_META[condition] || CONDITION_META.good
  return <StatusChip color={meta.color}>{meta.label}</StatusChip>
}

const URGENCY_META = {
  high: { label: "High priority", color: "var(--color-status-critical)" },
  medium: { label: "Medium priority", color: "var(--color-status-warn)" },
  low: { label: "Low priority", color: "var(--color-status-good)" },
}

export function UrgencyBadge({ urgency }) {
  const meta = URGENCY_META[urgency] || URGENCY_META.low
  return <StatusChip color={meta.color}>{meta.label}</StatusChip>
}

const JOB_STATUS_META = {
  completed: { label: "Completed", color: "var(--color-status-good)" },
  scheduled: { label: "Scheduled", color: "var(--color-status-idle)" },
}

export function StatusBadge({ status }) {
  const meta = JOB_STATUS_META[status] || JOB_STATUS_META.completed
  return <StatusChip color={meta.color}>{meta.label}</StatusChip>
}

export function VerifiedBadge({ verified }) {
  return verified ? (
    <StatusChip color="var(--color-status-good)">Verified</StatusChip>
  ) : (
    <span className="text-[12.5px] text-ink-3 whitespace-nowrap">Unverified</span>
  )
}

/** Two-segment health bar. Legend below carries identity; 2px gaps. */
export function ConditionMeter({ counts }) {
  const entries = ["good", "attention", "urgent"]
    .map((key) => ({ key, ...CONDITION_META[key], count: counts[key] || 0 }))
    .filter((e) => e.count > 0)
  const total = entries.reduce((sum, e) => sum + e.count, 0)
  if (total === 0) return <p className="text-sm text-ink-3">No systems recorded yet.</p>
  return (
    <div>
      <div className="flex h-2 gap-[2px] rounded-full overflow-hidden">
        {entries.map((e) => (
          <div key={e.key} style={{ flex: e.count, background: e.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
        {entries.map((e) => (
          <StatusChip key={e.key} color={e.color}>
            {e.label} · {e.count}
          </StatusChip>
        ))}
      </div>
    </div>
  )
}

/* ---------- page furniture ---------- */

/** The page's opening sentence. Pass `clause` for the de-emphasised half:
    "Your home is in good shape." + " One item sits on our watch list." */
export function PageHeader({ title, clause, subtitle, action }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-6">
      <div className="max-w-[620px]">
        <h1 className="font-display m-0 text-[32px] md:text-[44px] leading-[1.1] text-ink">
          {title}
          {clause && <span className="text-ink-4"> {clause}</span>}
        </h1>
        {subtitle && <p className="m-0 mt-4 text-[14.5px] leading-[1.65] text-ink-2 text-pretty">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Kept for pages not yet migrated. Now a quiet tinted block, not a
    white floating card — prefer <Section>. */
export function Card({ title, children, className = "", ...rest }) {
  return (
    <div className={`bg-sunk rounded-(--radius-block) p-5 md:p-6 ${className}`} {...rest}>
      {title && <p className="eyebrow m-0 mb-3.5">{title}</p>}
      {children}
    </div>
  )
}

export function StatTile({ label, value, sub, to }) {
  const body = <Figure value={value} label={sub ? `${label} · ${sub}` : label} />
  return to ? <Link to={to} className="block hover:opacity-70 transition-opacity">{body}</Link> : body
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-brand-700 text-surface hover:bg-brand-900",
    subtle: "bg-brand-100 text-brand-900 hover:bg-sunk",
    ghost: "text-ink-2 hover:text-ink hover:bg-ink/5",
    outline: "border border-line-2 text-ink-2 hover:border-ink-3",
    danger: "text-status-critical hover:bg-status-critical/10",
  }
  return (
    <button
      type="button"
      className={`rounded-(--radius-control) px-5 py-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Only for destructive confirmation and true detours. Anything a homeowner
    initiates should be inline (see AskBar). */
export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 backdrop-blur-[2px] p-4">
      <div className="bg-surface rounded-(--radius-panel) shadow-(--shadow-raised) w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display m-0 text-lg text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-3 hover:text-ink text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function DynamicForm({ fields, initialValues = {}, onSubmit, submitLabel = "Save" }) {
  const [values, setValues] = useState(() => {
    const defaults = {}
    fields.forEach((f) => {
      defaults[f.name] = initialValues[f.name] ?? (f.type === "number" ? 0 : "")
    })
    return defaults
  })
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))
  const inputClass =
    "border border-line-2 rounded-(--radius-control) px-3.5 py-2.5 bg-field text-ink focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
    >
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1 text-sm">
          <span className="text-[12.5px] text-ink-2">{field.label}</span>
          {field.type === "select" ? (
            <select className={inputClass} value={values[field.name]} onChange={(e) => set(field.name, e.target.value)}>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {field.optionLabels ? field.optionLabels[opt] : opt}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea className={inputClass} rows={3} value={values[field.name]} onChange={(e) => set(field.name, e.target.value)} />
          ) : (
            <input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              className={inputClass}
              value={values[field.name]}
              onChange={(e) => set(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
              placeholder={field.placeholder}
            />
          )}
        </label>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}
