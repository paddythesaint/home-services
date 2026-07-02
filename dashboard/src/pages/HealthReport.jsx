import { healthReport, property } from "../mockData"
import { Card, ConditionBadge, PageHeader } from "../components"

export default function HealthReport() {
  return (
    <div>
      <PageHeader
        title="Property Health Report"
        subtitle={`Generated ${healthReport.generatedOn} from your Property Profile Session at ${property.address}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {healthReport.systems.map((system) => (
          <Card key={system.category}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-brand-900">{system.category}</p>
                <p className="text-sm text-brand-600">{system.detail}</p>
              </div>
              <ConditionBadge condition={system.condition} />
            </div>
            <p className="text-sm text-brand-700 mt-3">{system.note}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
