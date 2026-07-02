import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import SeedBanner from "../SeedBanner"
import InsightsBanner from "../InsightsBanner"
import { closingDocsInsights } from "../documentInsights"
import { recordsIndexInsights } from "../recordsIndexInsights"
import { energyAuditInsights } from "../energyAuditInsights"
import { todayISO, isoToLabel } from "../dates"
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
  const healthApi = useItems(uid, "healthReport")
  const priorityApi = useItems(uid, "priorityList")
  const calendarApi = useItems(uid, "careCalendar")
  const { items: calendarItems, loading: calendarLoading } = calendarApi
  const jobApi = useItems(uid, "jobHistory")
  const { items: healthItems, loading: healthLoading } = healthApi
  const { items: priorityItems, loading: priorityLoading } = priorityApi
  const { items: jobItems } = jobApi
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
  const openPriorities = priorityItems.filter(
    (p) => !p.status || p.status === "open" || p.status === "scheduled"
  )
  const topPriorities = openPriorities.slice(0, 3)
  const recentJobs = jobItems.slice(-3).reverse()

  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long" })
  const thisMonthTasks = calendarItems.filter((t) => t.month === currentMonth)

  const dueChecks = healthItems
    .filter((s) => s.nextDue && s.nextDue <= todayISO())
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))

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

      {!dashboardEmpty && !profile.insightsAppliedOn && (
        <InsightsBanner
          title="Apply insights from your closing documents?"
          description="We reviewed the 2021 closing package — inspection addendum, certified radon report, appraisal, paint schedule, and the 2023 kitchen renovation estimate. This updates your systems with what they revealed (furnace replaced 2021, propane fuel, radon at 5.7 pCi/L with an unserviced mitigation system, two gas-log fireplaces flagged for service), adds a paint-color reference, and backfills your job history. Everything stays editable; mortgage details were excluded."
          buttonLabel="Apply document insights"
          flagField="insightsAppliedOn"
          insights={closingDocsInsights}
          healthApi={healthApi}
          priorityApi={priorityApi}
          jobApi={jobApi}
          saveProfile={saveProfile}
        />
      )}

      {!dashboardEmpty && !profile.recordsIndexAppliedOn && (
        <InsightsBanner
          title="Apply insights from your Home Records Index?"
          description="We reviewed the records index compiled from your Gmail and Drive. This adds your 22kW standby generator (installed 2021, serviced June 2026) and Dodson pest-control service, records the furnace's installer and warranty (Monticello Air, 2021), flags the 2025–26 roof insurance claim for follow-up, backfills six jobs, and adds priorities for the missing homeowner's-insurance policy and email-only documents worth saving."
          buttonLabel="Apply records-index insights"
          flagField="recordsIndexAppliedOn"
          insights={recordsIndexInsights}
          healthApi={healthApi}
          priorityApi={priorityApi}
          jobApi={jobApi}
          calendarApi={calendarApi}
          saveProfile={saveProfile}
        />
      )}

      {!dashboardEmpty && !profile.energyAuditAppliedOn && (
        <InsightsBanner
          title="Apply insights from your March 2026 energy audit?"
          description="We read the full 40-page LEAP energy audit (report #387364, March 10, 2026). Two safety findings lead: the water heaters failed the gas-leak screen (burner corrosion, loose exhaust gasket) and the auditor was blunt about the basement stove — 'fix it or get rid of it'. This also adds windows (mold in four rooms), ventilation (three bath fans at 0 CFM), attic insulation, and drainage as systems, logs the audit as a job, and queues the ~$687/yr weatherization package as a priority."
          buttonLabel="Apply energy-audit insights"
          flagField="energyAuditAppliedOn"
          insights={energyAuditInsights}
          healthApi={healthApi}
          priorityApi={priorityApi}
          jobApi={jobApi}
          calendarApi={calendarApi}
          saveProfile={saveProfile}
        />
      )}

      {dueChecks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-900">
          <span className="font-medium">
            {dueChecks.length} recurring check{dueChecks.length === 1 ? "" : "s"} due:
          </span>{" "}
          {dueChecks.map((s) => `${s.category} (${isoToLabel(s.nextDue)})`).join(", ")}.{" "}
          <Link to="/health-report" className="font-medium underline">
            Log them on the Health Report
          </Link>
          .
        </div>
      )}

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
          value={openPriorities.length}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card title="Property health">
          <ConditionMeter counts={conditionCounts} />
          <Link
            to="/health-report"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            View full health report &rarr;
          </Link>
        </Card>

        <Card title="Intake Assistant">
          <p className="text-sm text-ink-2">
            Build out the record by talking — tell it about any system, past
            work, or what needs doing, in any order.
          </p>
          <Link
            to="/assistant"
            className="inline-block mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            Open the assistant &rarr;
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
