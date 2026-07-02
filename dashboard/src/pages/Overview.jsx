import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import SeedBanner from "../SeedBanner"
import {
  Card,
  PageHeader,
  UrgencyBadge,
  StatusBadge,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const propertyFields = [
  { name: "address", label: "Address", type: "text" },
  { name: "areaLabel", label: "City / State / Zip", type: "text" },
  { name: "acreage", label: "Acreage", type: "number" },
  { name: "yearBuilt", label: "Year built", type: "number" },
  { name: "profileSessionDate", label: "Property Profile session date", type: "text" },
  { name: "conductedBy", label: "Conducted by", type: "text" },
  { name: "clientName", label: "Family / client name", type: "text" },
  { name: "tier", label: "Membership tier", type: "text" },
  { name: "monthlyRate", label: "Monthly rate ($)", type: "number" },
  { name: "nextInvoiceDate", label: "Next invoice date", type: "text" },
  { name: "referralCredits", label: "Referral credits (free months)", type: "number" },
]

export default function Overview() {
  const { uid, profile, saveProfile } = useOutletContext()
  const { items: healthItems, loading: healthLoading } = useItems(uid, "healthReport")
  const { items: priorityItems, loading: priorityLoading } = useItems(uid, "priorityList")
  const { items: calendarItems, loading: calendarLoading } = useItems(uid, "careCalendar")
  const { items: jobItems } = useItems(uid, "jobHistory")
  const [editingProperty, setEditingProperty] = useState(false)

  const dashboardEmpty =
    !healthLoading && !priorityLoading && !calendarLoading &&
    healthItems.length === 0 && priorityItems.length === 0 && calendarItems.length === 0

  const attentionCount = healthItems.filter((s) => s.condition !== "good").length
  const topPriorities = priorityItems.slice(0, 3)
  const recentJobs = jobItems.slice(-3).reverse()

  return (
    <div>
      <PageHeader
        title={profile.address}
        subtitle={`${profile.areaLabel}${profile.acreage ? ` · ${profile.acreage} acres` : ""}${profile.yearBuilt ? ` · Built ${profile.yearBuilt}` : ""}`}
        action={
          <Button variant="subtle" onClick={() => setEditingProperty(true)}>
            Edit property info
          </Button>
        }
      />

      {dashboardEmpty && <SeedBanner uid={uid} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm text-brand-600">Membership</p>
          <p className="text-xl font-semibold mt-1">{profile.tier || "—"}</p>
          <p className="text-sm text-brand-600 mt-1">
            {profile.monthlyRate ? `$${profile.monthlyRate}/mo` : "Rate not set"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-600">Property Health</p>
          <p className="text-xl font-semibold mt-1">
            {healthItems.length === 0
              ? "No data yet"
              : attentionCount === 0
                ? "All systems good"
                : `${attentionCount} item${attentionCount > 1 ? "s" : ""} flagged`}
          </p>
          <p className="text-sm text-brand-600 mt-1">
            {profile.profileSessionDate
              ? `Last profiled ${profile.profileSessionDate}`
              : "Add your Property Profile Session details"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-brand-600">Referral Credits</p>
          <p className="text-xl font-semibold mt-1">
            {profile.referralCredits || 0} free month
            {profile.referralCredits === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-brand-600 mt-1">Refer a neighbor to earn more</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Priorities">
          {topPriorities.length === 0 ? (
            <p className="text-sm text-brand-600">
              Nothing on your priority list yet.
            </p>
          ) : (
            <ul className="divide-y divide-brand-100">
              {topPriorities.map((item) => (
                <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-brand-900">{item.title}</p>
                    <p className="text-sm text-brand-600">{item.category}</p>
                  </div>
                  <UrgencyBadge urgency={item.urgency} />
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/priority-list"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            View full 90-day priority list &rarr;
          </Link>
        </Card>

        <Card title="Recent Activity">
          {recentJobs.length === 0 ? (
            <p className="text-sm text-brand-600">No jobs logged yet.</p>
          ) : (
            <ul className="divide-y divide-brand-100">
              {recentJobs.map((job) => (
                <li key={job.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-brand-900">{job.title}</p>
                    <p className="text-sm text-brand-600">
                      {job.date} · {job.sub}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </li>
              ))}
            </ul>
          )}
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

      {editingProperty && (
        <Modal title="Edit property info" onClose={() => setEditingProperty(false)}>
          <DynamicForm
            fields={propertyFields}
            initialValues={profile}
            submitLabel="Save"
            onSubmit={(values) => {
              saveProfile(values)
              setEditingProperty(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
