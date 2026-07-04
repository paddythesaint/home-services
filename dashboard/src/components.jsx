import { useState } from "react"

export function Card({ title, children, className = "" }) {
  return (
    <div
      className={`bg-surface border border-line rounded-2xl p-5 md:p-6 shadow-(--shadow-card) ${className}`}
    >
      {title && (
        <h2 className="text-[15px] font-semibold text-ink mb-3.5 tracking-tight">{title}</h2>
      )}
      {children}
    </div>
  )
}

// Status chips: a colored dot carries the state, the label stays in ink —
// per the status-palette rule, color never carries meaning alone.
function StatusChip({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 whitespace-nowrap">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
        aria-hidden="true"
      />
      {children}
    </span>
  )
}

export const CONDITION_META = {
  good: { label: "Good", color: "var(--color-status-good)" },
  attention: { label: "Attention", color: "var(--color-status-warn)" },
  urgent: { label: "Urgent", color: "var(--color-status-critical)" },
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
  scheduled: { label: "Scheduled", color: "var(--color-ink-3)" },
}

export function StatusBadge({ status }) {
  const meta = JOB_STATUS_META[status] || JOB_STATUS_META.completed
  return <StatusChip color={meta.color}>{meta.label}</StatusChip>
}

export function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 whitespace-nowrap">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="var(--color-status-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
  ) : (
    <span className="text-xs font-medium text-ink-3 whitespace-nowrap">Unverified</span>
  )
}

// Stat tile per the dataviz figure contract: sentence-case label,
// semibold value, optional secondary line. Values stay proportional-figure.
export function StatTile({ label, value, sub }) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 md:p-5 shadow-(--shadow-card)">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="font-display text-[28px] font-semibold text-ink mt-1 leading-tight">{value}</p>
      {sub && <p className="text-xs text-ink-3 mt-1">{sub}</p>}
    </div>
  )
}

// Horizontal segmented meter of system conditions. Status colors carry the
// fill; the legend row beneath (dot + label + count in ink) is the identity
// channel, so the bar is never read by color alone. 2px surface gaps.
export function ConditionMeter({ counts }) {
  const entries = ["good", "attention", "urgent"]
    .map((key) => ({ key, ...CONDITION_META[key], count: counts[key] || 0 }))
    .filter((e) => e.count > 0)
  const total = entries.reduce((sum, e) => sum + e.count, 0)

  if (total === 0) {
    return <p className="text-sm text-ink-3">No systems recorded yet.</p>
  }

  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-surface">
        {entries.map((e) => (
          <div
            key={e.key}
            style={{ width: `${(e.count / total) * 100}%`, background: e.color }}
            className="first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {entries.map((e) => (
          <StatusChip key={e.key} color={e.color}>
            {e.label} · {e.count}
          </StatusChip>
        ))}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl md:text-[32px] font-semibold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2 mt-1.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary:
      "bg-brand-700 text-white shadow-(--shadow-card) hover:bg-brand-800 hover:shadow-(--shadow-raised)",
    subtle: "bg-brand-100 text-brand-900 hover:bg-brand-200",
    ghost: "text-ink-2 hover:text-ink hover:bg-ink/5",
    danger: "text-status-critical hover:bg-status-critical/10",
  }
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-plane disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 backdrop-blur-[2px] p-4">
      <div className="bg-surface rounded-2xl shadow-(--shadow-raised) w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-3 hover:text-ink text-xl leading-none"
          >
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

  function handleChange(name, value) {
    setValues((v) => ({ ...v, [name]: value }))
  }

  const inputClass =
    "border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink transition-shadow focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"

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
          <span className="font-medium text-ink-2">{field.label}</span>
          {field.type === "select" ? (
            <select
              className={inputClass}
              value={values[field.name]}
              onChange={(e) => handleChange(field.name, e.target.value)}
            >
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {field.optionLabels ? field.optionLabels[opt] : opt}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              className={inputClass}
              rows={3}
              value={values[field.name]}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              className={inputClass}
              value={values[field.name]}
              onChange={(e) =>
                handleChange(
                  field.name,
                  field.type === "number" ? Number(e.target.value) : e.target.value
                )
              }
              placeholder={field.placeholder}
            />
          )}
        </label>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
