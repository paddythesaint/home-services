import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import SeedBanner from "../SeedBanner"
import OnboardingChecklist from "../OnboardingChecklist"
import Members from "../Members"
import { seedAddressHint } from "../seedData"
import { viewFor } from "../roles"
import { isUnderway } from "../workOrders"
import HomeownerHome from "../HomeownerHome"
import RelationshipCard from "../RelationshipCard"
import SystemsGlance from "../SystemsGlance"
import { tradeForText } from "../trades"
import hero895 from "../assets/hero-895.jpg"
import { todayISO, isoToLabel } from "../dates"
import { resolutionCounts } from "../resolution"
import { homeFeed, FEED_KIND_LABEL } from "../homeFeed"
import {
  Card,
  PageHeader,
  UrgencyBadge,
  StatTile,
  Button,
  Modal,
  DynamicForm,
} from "../components"

const propertyFields = [
  { name: "address", label: "Address", type: "text" },
  { name: "areaLabel", label: "City / State / Zip", type: "text" },
  { name: "acreage", label: "Acreage", type: "number" },
  { name: "yearBuilt", label: "Year built", type: "number" },
  { name: "parcelId", label: "Parcel / tax-map ID", type: "text" },
  { name: "bedrooms", label: "Bedrooms", type: "number" },
  { name: "bathrooms", label: "Bathrooms", type: "number" },
  { name: "profileSessionDate", label: "Property Profile session date", type: "text" },
  { name: "conductedBy", label: "Conducted by", type: "text" },
  { name: "clientName", label: "Family / client name", type: "text" },
  {
    name: "emailTag",
    label: "Email intake tag (optional)",
    type: "text",
    // Sender routing is primary: mail FROM any member's address files here
    // automatically (their email is captured once, on the new-home form).
    // The +tag stays as an override for mail from unregistered senders.
    placeholder: "e.g. 895 — member emails route automatically; +tag covers other senders",
  },
  { name: "tier", label: "Membership tier", type: "text" },
  { name: "monthlyRate", label: "Monthly rate ($)", type: "number" },
  { name: "nextInvoiceDate", label: "Next invoice date", type: "text" },
  { name: "referralCredits", label: "Referral credits (free months)", type: "number" },
]

// Homeowners get the calm home screen; staff and founders get the full
// operational overview. Branching in a wrapper keeps hook order stable
// when a founder flips the View-as lens.
export default function Overview() {
  const { user } = useOutletContext()
  return viewFor(user?.email).role === "homeowner" ? <HomeownerHome /> : <FullOverview />
}

function FullOverview() {
  const { uid, profile, saveProfile, user } = useOutletContext()
  const healthApi = useItems(uid, "healthReport")
  const priorityApi = useItems(uid, "priorityList")
  const calendarApi = useItems(uid, "careCalendar")
  const { items: calendarItems, loading: calendarLoading } = calendarApi
  const jobApi = useItems(uid, "jobHistory")
  const { items: workOrders } = useItems(uid, "workOrders")
  const { items: conversations } = useItems(uid, "conversations")
  const { items: briefs } = useItems(uid, "briefs")
  const { items: healthItems, loading: healthLoading } = healthApi
  const { items: priorityItems, loading: priorityLoading } = priorityApi
  const { items: jobItems } = jobApi
  const [editingProperty, setEditingProperty] = useState(false)

  const dashboardEmpty =
    !healthLoading && !priorityLoading && !calendarLoading &&
    healthItems.length === 0 && priorityItems.length === 0 && calendarItems.length === 0

  const verifiedCount = healthItems.filter((s) => s.verified).length
  const completedJobs = jobItems.filter((j) => j.status === "completed").length
  const openPriorities = priorityItems.filter(
    (p) => !p.status || p.status === "open" || p.status === "scheduled"
  )
  const topPriorities = openPriorities.slice(0, 3)
  const feed = homeFeed({ jobs: jobItems, conversations, briefs }, 6)

  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long" })
  const thisMonthTasks = calendarItems.filter((t) => t.month === currentMonth)

  const dueChecks = healthItems
    .filter((s) => s.nextDue && s.nextDue <= todayISO())
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))

  // The starter seed and the document-insights banners were assembled from
  // the original property's records — never offer them on another home.
  const isSeedProperty = seedAddressHint.test(profile.address || "")

  const headerSubtitle = `${profile.areaLabel}${profile.acreage ? ` · ${profile.acreage} acres` : ""}${profile.yearBuilt ? ` · Built ${profile.yearBuilt}` : ""}`

  return (
    <div>
      {/* Founders start their day on the business plane; this page is one
          client's home. A slim strip keeps the morning route one tap away
          (fresh-eyes assessment: "every business day starts on the wrong
          screen"). */}
      {viewFor(user?.email).business && (
        <Link
          to="/ops"
          className="flex items-center justify-between gap-3 bg-sunk border border-line-2 rounded-xl px-4 py-2.5 mb-4 text-sm text-ink-2 hover:text-ink"
        >
          <span>
            Running the day? The <span className="font-medium">Command Center</span> has
            today's attention list, sorted.
          </span>
          <span className="text-brand-700 shrink-0">Open →</span>
        </Link>
      )}
      {isSeedProperty ? (
        // The property gets a face: aerial hero with the address set over a
        // scrim. Photo is bundled for the flagship home for now; per-property
        // photos ride with the design overhaul.
        <div className="relative rounded-2xl overflow-hidden mb-6 shadow-(--shadow-card)">
          <img
            src={hero895}
            alt={profile.address}
            className="w-full h-52 md:h-72 object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-brand-950/75 via-brand-950/15 to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-4xl font-semibold text-white leading-tight">
                {profile.address}
              </h1>
              <p className="text-sm text-white/85 mt-1.5">{headerSubtitle}</p>
            </div>
            <Button
              variant="subtle"
              className="shrink-0 !bg-white/90 hover:!bg-white !text-brand-900"
              onClick={() => setEditingProperty(true)}
            >
              Edit property info
            </Button>
          </div>
        </div>
      ) : (
        <PageHeader
          title={profile.address}
          subtitle={headerSubtitle}
          action={
            <Button variant="subtle" onClick={() => setEditingProperty(true)}>
              Edit property info
            </Button>
          }
        />
      )}

      {dashboardEmpty && isSeedProperty && <SeedBanner uid={uid} />}

      {/* The two-step signup's second half, visible: the background
          researcher works this address against public records and files
          what it finds — sourced, unverified until confirmed. */}
      {profile.research === "requested" && (
        <Card className="mb-4">
          <p className="m-0 text-sm text-ink-2">
            <span className="font-medium text-ink">Researching this address…</span>{" "}
            We're checking public records and listings for the basics — year built,
            lot, systems, sale history. Details file into the record automatically,
            usually within about ten minutes.
          </p>
        </Card>
      )}
      {profile.research === "done" && dashboardEmpty && (
        <Card className="mb-4">
          <p className="m-0 text-sm text-ink-2">
            <span className="font-medium text-ink">
              Address research done{profile.researchOn ? ` — ${profile.researchOn}` : ""}.
            </span>{" "}
            {profile.researchFactCount || 0} public-record detail
            {(profile.researchFactCount || 0) === 1 ? "" : "s"} filed to the record
            {profile.researchNote ? ` · ${profile.researchNote}` : ""}
          </p>
        </Card>
      )}

      {!isSeedProperty && viewFor(user?.email).staff && (
        <OnboardingChecklist profile={profile} systems={healthItems} jobs={jobItems} />
      )}

      {workOrders.filter(isUnderway).length > 0 && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-2">
            Happening now
          </p>
          <ul className="flex flex-col gap-1.5">
            {workOrders.filter(isUnderway).map((w) => (
              <li key={w.id} className="text-sm text-ink-2">
                <span className="font-medium text-ink">{w.title}</span>
                {w.lane === "in-progress"
                  ? " — being worked on"
                  : w.scheduledFor
                    ? ` — scheduled for ${w.scheduledFor}`
                    : " — on the calendar"}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dueChecks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-900">
          <span className="font-medium">
            {dueChecks.length} recurring check{dueChecks.length === 1 ? "" : "s"} due:
          </span>{" "}
          {dueChecks.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link to={`/system/${s.id}`} className="font-medium underline">
                {s.category}
              </Link>{" "}
              ({isoToLabel(s.nextDue)})
            </span>
          ))}
          .{" "}
          <Link to="/health-report" className="font-medium underline">
            Log them on Health of the house
          </Link>
          .
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile
          label="Systems verified"
          value={healthItems.length > 0 ? `${verifiedCount}/${healthItems.length}` : "—"}
          to="/health-report"
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
          to="/priority-list"
          sub={(() => {
            const c = resolutionCounts(priorityItems)
            return c.open > 0
              ? `${c.ready} ready to action · ${c.nextVisit} on next visit`
              : "Next 90 days"
          })()}
        />
        <StatTile
          label="Jobs completed"
          value={completedJobs}
          to="/job-history"
          sub="All time"
        />
        <StatTile
          label="This month"
          value={thisMonthTasks.length}
          to="/care-calendar"
          sub={`${currentMonth} care tasks`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Systems at a glance">
          <SystemsGlance items={healthItems} />
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
                    {item.category && (
                      <Link
                        to={`/health-report#trade-${tradeForText(item.category, item.title).key}`}
                        className="text-xs text-ink-3 hover:text-brand-700"
                      >
                        {item.category}
                      </Link>
                    )}
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

        {/* The home newsfeed: jobs done, emails received (and what was
            filed from them), briefs sent — one merged acknowledgment
            stream, composed from data the record already holds. */}
        <Card title="Recent activity">
          {feed.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {feed.map((e, i) => (
                <li key={`${e.kind}-${i}`} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink m-0 truncate">{e.title}</p>
                    <p className="text-xs text-ink-3 m-0">
                      {[e.when, e.detail].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="numeric shrink-0 text-[10.5px] uppercase tracking-wide text-ink-3 pt-0.5">
                    {FEED_KIND_LABEL[e.kind]}
                  </span>
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

      <div className="mt-4">
        <Members uid={uid} profile={profile} currentEmail={user?.email} />
      </div>

      {viewFor(user?.email).business && <RelationshipCard uid={uid} />}

      <p className="text-xs text-ink-3 mt-4">
        Have a prepared data bundle (photos + facts)?{" "}
        <Link to="/import" className="underline">
          Import it here
        </Link>
        .
      </p>

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
