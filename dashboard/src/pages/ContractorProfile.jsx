import { useEffect, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
  subscribeContractors,
  updateContractor,
  removeContractor,
  fetchMemberProperties,
  updateItem,
} from "../firestoreApi"
import { isFounder } from "../founders"
import { jobMatchesContractor, unlinkedMatches, groupJobsByProperty } from "../contractorMatching"
import { contractorFields } from "../contractorShared"
import { PropertyJobFeed } from "../PortfolioJobs"
import { Card, PageHeader, Button, Modal, DynamicForm, StatTile } from "../components"

// One contractor, in full: identity and contacts, their working history
// grouped by home across the whole portfolio, and the management actions.
// This is where every contractor-name link in the app lands.
export default function ContractorProfile() {
  const { user } = useOutletContext()
  const { contractorId } = useParams()
  const navigate = useNavigate()
  const founder = isFounder(user?.email)

  const [contractors, setContractors] = useState(null)
  const [properties, setProperties] = useState([])
  const [jobsByProperty, setJobsByProperty] = useState({})
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (!founder) return
    return subscribeContractors(setContractors, () => setContractors([]))
  }, [founder])

  useEffect(() => {
    if (!founder) return
    let active = true
    fetchMemberProperties(user.email).then((list) => active && setProperties(list))
    return () => {
      active = false
    }
  }, [founder, user?.email])

  if (!founder) {
    return (
      <div>
        <PageHeader title="Contractor profile" subtitle="Founders only." />
        <Card>
          <p className="text-sm text-ink-2">
            This is the business-side contractor database.{" "}
            <Link to="/" className="underline">
              Back to the homeowner view
            </Link>
            .
          </p>
        </Card>
      </div>
    )
  }

  const contractor = contractors?.find((c) => c.id === contractorId)
  const allJobs = Object.values(jobsByProperty).flat()
  const jobs = contractor ? allJobs.filter((j) => jobMatchesContractor(j, contractor)) : []
  const homes = groupJobsByProperty(jobs)
  const unlinked = contractor ? unlinkedMatches(allJobs, contractor) : []
  const lastJob = jobs.reduce((a, j) => (!a || (j.order || 0) > (a.order || 0) ? j : a), null)

  async function linkJobs() {
    setLinking(true)
    for (const j of unlinked) {
      await updateItem(j.propertyId, "jobHistory", j.id, { contractorId: contractor.id })
    }
    setLinking(false)
  }

  if (contractors === null) {
    return <p className="text-ink-2">Loading contractor…</p>
  }
  if (!contractor) {
    return (
      <div>
        <PageHeader title="Contractor not found" subtitle="It may have been removed." />
        <Link to="/contractor-network" className="text-sm text-brand-600 underline">
          &larr; Back to the Contractor Network
        </Link>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-3">
        <Link
          to="/contractor-network"
          className="text-sm font-medium text-brand-600 hover:text-brand-800"
        >
          &larr; Contractor Network
        </Link>
      </p>
      <PageHeader
        title={contractor.name}
        subtitle={[contractor.trades, contractor.cadence && `Cadence: ${contractor.cadence}`]
          .filter(Boolean)
          .join(" · ")}
        action={
          <span className="flex gap-2">
            <Button variant="subtle" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatTile label="Homes served" value={homes.length} sub="Across the portfolio" />
        <StatTile label="Jobs on record" value={jobs.length} sub="Linked + name-matched" />
        <StatTile label="Last job" value={lastJob?.date || "—"} sub={lastJob?.title || "No jobs yet"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Contact & sourcing">
          <ul className="text-sm text-ink-2 flex flex-col gap-1.5">
            <li>
              <span className="text-ink-3">Phone: </span>
              {contractor.phone ? (
                <a href={`tel:${contractor.phone}`} className="text-brand-600 hover:text-brand-800">
                  {contractor.phone}
                </a>
              ) : (
                "—"
              )}
            </li>
            <li>
              <span className="text-ink-3">Email: </span>
              {contractor.email ? (
                <a href={`mailto:${contractor.email}`} className="text-brand-600 hover:text-brand-800">
                  {contractor.email}
                </a>
              ) : (
                "—"
              )}
            </li>
            <li>
              <span className="text-ink-3">Website: </span>
              {contractor.website ? (
                <a
                  href={contractor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:text-brand-800 underline"
                >
                  {contractor.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              ) : (
                "—"
              )}
            </li>
            {contractor.sourcing && (
              <li>
                <span className="text-ink-3">Sourced: </span>
                {contractor.sourcing}
              </li>
            )}
          </ul>
          {contractor.notes && (
            <p className="text-sm text-ink-2 mt-3 pt-3 border-t border-line whitespace-pre-line">
              {contractor.notes}
            </p>
          )}
        </Card>

        <div className="lg:col-span-2">
          <Card title="Work history, by home">
            {unlinked.length > 0 && (
              <div className="bg-brand-100 border border-line rounded-lg p-3 mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-2">
                  {unlinked.length} job{unlinked.length === 1 ? "" : "s"} match this name but
                  aren't linked to the profile yet.
                </p>
                <Button variant="subtle" onClick={linkJobs} disabled={linking}>
                  {linking ? "Linking…" : "Link them"}
                </Button>
              </div>
            )}
            {homes.length === 0 ? (
              <p className="text-sm text-ink-3">
                No jobs on record yet — they'll appear here as work is logged with this
                contractor picked on the Job History page.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {homes.map((home) => (
                  <div key={home.propertyId} className="bg-plane rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-ink">
                      {home.propertyLabel}
                      <span className="font-normal text-ink-3">
                        {" "}
                        · {home.jobs.length} job{home.jobs.length === 1 ? "" : "s"}
                      </span>
                    </p>
                    <ul className="mt-1 divide-y divide-line">
                      {home.jobs.map((j) => (
                        <li key={j.id} className="py-1.5 flex items-start justify-between gap-3 text-xs">
                          <span className="text-ink-2">
                            {j.date ? `${j.date} · ` : ""}
                            {j.title}
                          </span>
                          <span className="text-ink-3 shrink-0">{j.cost || ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {properties.map((p) => (
        <PropertyJobFeed
          key={p.id}
          propertyId={p.id}
          propertyLabel={p.address}
          onJobs={(pid, list) => setJobsByProperty((prev) => ({ ...prev, [pid]: list }))}
        />
      ))}

      {editing && (
        <Modal title="Edit contractor" onClose={() => setEditing(false)}>
          <DynamicForm
            fields={contractorFields}
            initialValues={contractor}
            onSubmit={(values) => {
              updateContractor(contractor.id, values)
              setEditing(false)
            }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete contractor?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{contractor.name}" from the network? Job history is not changed.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await removeContractor(contractor.id)
                navigate("/contractor-network")
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
