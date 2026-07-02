import { priorityList } from "../mockData"
import { Card, PageHeader, UrgencyBadge } from "../components"

export default function PriorityList() {
  return (
    <div>
      <PageHeader
        title="90-Day Priority List"
        subtitle="Ranked recommendations drawn from your Property Health Report — the fastest path from your Property Profile Session to dispatched work."
      />
      <div className="flex flex-col gap-3">
        {priorityList.map((item) => (
          <Card key={item.rank}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold shrink-0">
                  {item.rank}
                </span>
                <div>
                  <p className="font-semibold text-brand-900">{item.title}</p>
                  <p className="text-sm text-brand-600">{item.category}</p>
                  <p className="text-sm text-brand-700 mt-1.5">{item.reason}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <UrgencyBadge urgency={item.urgency} />
                <p className="text-sm text-brand-600 mt-2">{item.estCost}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
