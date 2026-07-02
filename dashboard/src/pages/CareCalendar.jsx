import { careCalendar } from "../mockData"
import { Card, PageHeader } from "../components"

const CURRENT_MONTH = "July"

export default function CareCalendar() {
  return (
    <div>
      <PageHeader
        title="Annual Care Calendar"
        subtitle="Your seasonal maintenance schedule, generated from your property's systems inventory and Charlottesville-area climate patterns."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {careCalendar.map((month) => (
          <Card
            key={month.month}
            className={
              month.month === CURRENT_MONTH ? "border-brand-400 ring-1 ring-brand-400" : ""
            }
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-brand-900">{month.month}</p>
              {month.month === CURRENT_MONTH && (
                <span className="text-xs font-medium text-brand-600">
                  This month
                </span>
              )}
            </div>
            <ul className="text-sm text-brand-700 space-y-1 list-disc list-inside">
              {month.tasks.map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
