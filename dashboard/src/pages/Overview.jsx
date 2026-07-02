import { Link } from "react-router-dom"
import { client, property, healthReport, priorityList, jobHistory } from "../mockData"
import { Card, PageHeader, UrgencyBadge, StatusBadge } from "../components"

export default function Overview() {
  const attentionCount = healthReport.systems.filter(
    (s) => s.condition !== "good"
  ).length
  const topPriorities = priorityList.slice(0, 3)
  const recentJobs = jobHistory.slice(0, 3)

  return (
    <div>
      <PageHeader
        title={`${property.address}`}
        subtitle={`${property.areaLabel} · ${property.acreage} acres · Built ${property.yearBuilt}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm text-brand-600">Membership</p>
          <p className="text-xl font-semibold mt-1">{client.tier}</p>
          <p className="text-sm text-brand-600 mt-1">
            ${client.monthlyRate}/mo · locked for life
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-600">Property Health</p>
          <p className="text-xl font-semibold mt-1">
            {attentionCount === 0
              ? "All systems good"
              : `${attentionCount} item${attentionCount > 1 ? "s" : ""} flagged`}
          </p>
          <p className="text-sm text-brand-600 mt-1">
            Last profiled {healthReport.generatedOn}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-600">Referral Credits</p>
          <p className="text-xl font-semibold mt-1">
            {client.referralCredits} free month{client.referralCredits === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-brand-600 mt-1">
            Refer a neighbor to earn more
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Priorities">
          <ul className="divide-y divide-brand-100">
            {topPriorities.map((item) => (
              <li key={item.rank} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-900">{item.title}</p>
                  <p className="text-sm text-brand-600">{item.category}</p>
                </div>
                <UrgencyBadge urgency={item.urgency} />
              </li>
            ))}
          </ul>
          <Link
            to="/priority-list"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            View full 90-day priority list &rarr;
          </Link>
        </Card>

        <Card title="Recent Activity">
          <ul className="divide-y divide-brand-100">
            {recentJobs.map((job, i) => (
              <li key={i} className="py-2.5 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-900">{job.title}</p>
                  <p className="text-sm text-brand-600">{job.date} · {job.sub}</p>
                </div>
                <StatusBadge status={job.status} />
              </li>
            ))}
          </ul>
          <Link
            to="/job-history"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            View full job history &rarr;
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Link to="/health-report">
          <Card className="hover:border-brand-400 transition-colors h-full">
            <p className="font-semibold text-brand-900">Property Health Report</p>
            <p className="text-sm text-brand-600 mt-1">
              Full systems inventory generated from your Property Profile Session.
            </p>
          </Card>
        </Link>
        <Link to="/care-calendar">
          <Card className="hover:border-brand-400 transition-colors h-full">
            <p className="font-semibold text-brand-900">Annual Care Calendar</p>
            <p className="text-sm text-brand-600 mt-1">
              Your month-by-month seasonal maintenance schedule.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  )
}
