import { useState } from "react"

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

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">{title}</h1>
        {subtitle && <p className="text-brand-600 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    subtle: "bg-brand-100 text-brand-700 hover:bg-brand-200",
    ghost: "text-brand-600 hover:text-brand-800",
    danger: "text-red-600 hover:text-red-800",
  }
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100">
          <h2 className="font-semibold text-brand-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-brand-400 hover:text-brand-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
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
          <span className="font-medium text-brand-800">{field.label}</span>
          {field.type === "select" ? (
            <select
              className="border border-brand-200 rounded-md px-3 py-2"
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
              className="border border-brand-200 rounded-md px-3 py-2"
              rows={3}
              value={values[field.name]}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              className="border border-brand-200 rounded-md px-3 py-2"
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
