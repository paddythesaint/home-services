import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import SeedBanner from "../SeedBanner"
import {
  Card,
  PageHeader,
  UrgencyBadge,
  StatusBadge,
  StatTile,
  ConditionMeter,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const propertyFields = [
  { name: "address", label: "Address", type: "text" },
  { name: "areaLabel", label: "City / State / Zip", type: "text" },
  { name: "acreage", label: "Acreage", type: "number" },
  { name: "yearBuilt", label: "Year built", type: "number" },
  { name: "bedrooms", label: "Bedrooms", type: "number" },
  { name: "bathrooms", label: "Bathrooms", type: "number" },
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

  const verifiedCount = healthItems.filter((s) => s.verified).length
  const conditionCounts = healthItems.reduce((acc, s) => {
    acc[s.condition] = (acc[s.condition] || 0) + 1
    return acc
  }, {})
  const completedJobs = jobItems.filter((j) => j.status === "completed").length
  const topPriorities = priorityItems.slice(0, 3)
  const recentJobs = jobItems.slice(-3).reverse()

  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long" })
  const thisMonthTasks = calendarItems.filter((t) => t.month === currentMonth)

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile
          label="Systems verified"
          value={healthItems.length > 0 ? `${verifiedCount}/${healthItems.length}` : "—"}
          sub={
            verifiedCount < healthItems.length
              ? "Run the walkthrough to verify"
              : healthItems.length > 0
                ? "All confirmed in person"
                : "No systems yet"
          }
        />
        <StatTile
          label="Open priorities"
          value={priorityItems.length}
          sub="Next 90 days"
        />
        <StatTile
          label="Jobs completed"
          value={completedJobs}
          sub="All time"
        />
        <StatTile
          label="This month"
          value={thisMonthTasks.length}
          sub={`${currentMonth} care tasks`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Property health">
          <ConditionMeter counts={conditionCounts} />
          <Link
            to="/health-report"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            View full health report &rarr;
          </Link>
        </Card>

        <Card title="Walkthrough">
          <p className="text-sm text-ink-2">
            {profile.walkthroughCompletedOn
              ? `Last completed ${profile.walkthroughCompletedOn}. Re-run anytime to pick up skipped or new systems.`
              : "Verify the property record in person — confirm each system, snap nameplate photos, and let the app read brands and install years off them."}
          </p>
          <Link
            to="/walkthrough"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            {profile.walkthroughCompletedOn ? "Run walkthrough again" : "Start the walkthrough"} &rarr;
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top priorities">
          {topPriorities.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing on your priority list yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {topPriorities.map((item) => (
                <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-ink-3">{item.category}</p>
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

        <Card title="Recent activity">
          {recentJobs.length === 0 ? (
            <p className="text-sm text-ink-3">No jobs logged yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentJobs.map((job) => (
                <li key={job.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{job.title}</p>
                    <p className="text-xs text-ink-3">
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
