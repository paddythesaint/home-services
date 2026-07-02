export function Card({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white border border-brand-200 rounded-lg p-5 shadow-sm ${className}`}
    >
      {title && (
        <h2 className="text-base font-semibold text-brand-900 mb-3">{title}</h2>
      )}
      {children}
    </div>
  )
}

const conditionStyles = {
  good: "bg-brand-100 text-brand-700",
  attention: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-700",
}

export function ConditionBadge({ condition }) {
  const label = { good: "Good", attention: "Attention", urgent: "Urgent" }[
    condition
  ]
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${conditionStyles[condition] || conditionStyles.good}`}
    >
      {label}
    </span>
  )
}

const urgencyStyles = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-brand-100 text-brand-700",
}

export function UrgencyBadge({ urgency }) {
  const label = { high: "High", medium: "Medium", low: "Low" }[urgency]
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${urgencyStyles[urgency] || urgencyStyles.low}`}
    >
      {label} priority
    </span>
  )
}

const statusStyles = {
  completed: "bg-brand-100 text-brand-700",
  scheduled: "bg-blue-100 text-blue-700",
}

export function StatusBadge({ status }) {
  const label = { completed: "Completed", scheduled: "Scheduled" }[status]
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] || statusStyles.completed}`}
    >
      {label}
    </span>
  )
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-brand-900">{title}</h1>
      {subtitle && <p className="text-brand-600 mt-1">{subtitle}</p>}
    </div>
  )
}
