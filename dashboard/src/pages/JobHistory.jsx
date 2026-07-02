import { jobHistory } from "../mockData"
import { Card, PageHeader, StatusBadge } from "../components"

export default function JobHistory() {
  return (
    <div>
      <PageHeader
        title="Job History"
        subtitle="A complete record of every job dispatched on your property — sub, cost, and notes, indexed by date."
      />
      <div className="flex flex-col gap-3">
        {jobHistory.map((job, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-brand-900">{job.title}</p>
                <p className="text-sm text-brand-600">
                  {job.date} · {job.category} · {job.sub}
                </p>
                <p className="text-sm text-brand-700 mt-1.5">{job.notes}</p>
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={job.status} />
                <p className="text-sm text-brand-600 mt-2">{job.cost}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
