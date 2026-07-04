import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import {
  subscribeContractors,
  addContractor,
  updateContractor,
  removeContractor,
  fetchPropertyContractors,
  fetchMemberProperties,
  updateItem,
} from "../firestoreApi"
import { useItems } from "../useItems"
import { isFounder } from "../founders"
import {
  norm,
  jobMatchesContractor,
  unlinkedMatches,
  groupJobsByProperty,
} from "../contractorMatching"
import { Card, PageHeader, Button, Modal, DynamicForm } from "../components"

const fields = [
  { name: "name", label: "Name", type: "text" },
  { name: "trades", label: "Trades", type: "text", placeholder: "e.g. HVAC, Roofing" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "email", label: "Email", type: "text" },
  {
    name: "cadence",
    label: "Service cadence",
    type: "text",
    placeholder: "e.g. Bi-monthly, Annual (June)",
  },
  { name: "sourcing", label: "How sourced", type: "text" },
  { name: "notes", label: "Notes", type: "textarea" },
]

// Subscribes to one property's job history and reports jobs up, tagged with
// which property they're from — the cross-property aggregation unit.
function PropertyJobFeed({ propertyId, propertyLabel, onJobs }) {
  const { items } = useItems(propertyId, "jobHistory")
  useEffect(() => {
    onJobs(propertyId, items.map((j) => ({ ...j, propertyId, propertyLabel })))
  }, [propertyId, propertyLabel, items])
  return null
}

function ImportPanel({ properties, existingNames, onImported }) {
  const [candidates, setCandidates] = useState(null) // null = not loaded
  const [selected, setSelected] = useState(new Set())
  const [importing, setImporting] = useState(false)

  async function load() {
    const seen = new Set(existingNames)
    const found = []
    for (const p of properties) {
      const roster = await fetchPropertyContractors(p.id)
      for (const c of roster) {
        const key = norm(c.name)
        if (!key || seen.has(key)) continue
        seen.add(key)
        found.push({ ...c, sourceProperty: p.address })
      }
    }
    setCandidates(found)
    setSelected(new Set(found.map((c) => c.name)))
  }

  async function doImport() {
    setImporting(true)
    for (const c of candidates.filter((c) => selected.has(c.name))) {
      await addContractor({
        name: c.name,
        trades: c.trades || "",
        phone: c.phone || "",
        email: "",
        cadence: "",
        sourcing: c.sourcing || `Imported from ${c.sourceProperty}`,
        notes: c.notes || "",
      })
    }
    setImporting(false)
    setCandidates(null)
    onImported()
  }

  if (candidates === null) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-2">
            Pull vendors from each property's local roster into the shared network.
          </p>
          <Button variant="subtle" onClick={load}>
            Check property rosters
          </Button>
        </div>
      </Card>
    )
  }

  if (candidates.length === 0) {
    return (
      <Card>
        <p className="text-sm text-ink-3">
          Nothing new — every property vendor is already in the network.
        </p>
      </Card>
    )
  }

  const toggle = (name) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  return (
    <Card title="Import from property rosters">
      <ul className="divide-y divide-line mb-3">
        {candidates.map((c) => (
          <li key={c.name} className="py-2 flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 accent-brand-700"
              checked={selected.has(c.name)}
              onChange={() => toggle(c.name)}
            />
            <div>
              <p className="text-sm font-medium text-ink">{c.name}</p>
              <p className="text-xs text-ink-3">
                {[c.trades, c.phone, `from ${c.sourceProperty}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="subtle" onClick={() => setCandidates(null)}>
          Cancel
        </Button>
        <Button onClick={doImport} disabled={importing || selected.size === 0}>
          {importing ? "Importing…" : `Import ${selected.size || ""}`}
        </Button>
      </div>
    </Card>
  )
}

export default function BusinessContractors() {
  const { user } = useOutletContext()
  const founder = isFounder(user?.email)

  const [state, setState] = useState({ status: "loading", contractors: [] })
  const [properties, setProperties] = useState([])
  const [jobsByProperty, setJobsByProperty] = useState({})
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [linking, setLinking] = useState(null) // contractor id currently linking

  useEffect(() => {
    if (!founder) return
    const unsub = subscribeContractors(
      (list) => setState({ status: "ready", contractors: list }),
      () => setState({ status: "denied", contractors: [] })
    )
    return unsub
  }, [founder])

  useEffect(() => {
    if (!founder) return
    let active = true
    fetchMemberProperties(user.email).then((list) => active && setProperties(list))
    return () => {
      active = false
    }
  }, [founder, user?.email])

  const allJobs = Object.values(jobsByProperty).flat()

  async function linkJobs(contractor) {
    setLinking(contractor.id)
    for (const j of unlinkedMatches(allJobs, contractor)) {
      await updateItem(j.propertyId, "jobHistory", j.id, { contractorId: contractor.id })
    }
    setLinking(null)
  }

  async function linkAll() {
    setLinking("all")
    for (const c of state.contractors) {
      for (const j of unlinkedMatches(allJobs, c)) {
        await updateItem(j.propertyId, "jobHistory", j.id, { contractorId: c.id })
      }
    }
    setLinking(null)
  }

  const totalUnlinked = state.contractors.reduce(
    (n, c) => n + unlinkedMatches(allJobs, c).length,
    0
  )

  if (!founder) {
    return (
      <div>
        <PageHeader title="Contractor Network" subtitle="Founders only." />
        <Card>
          <p className="text-sm text-ink-2">
            This is the business-side contractor database and isn't part of the property
            record. <Link to="/" className="underline">Back to the homeowner view</Link>.
          </p>
        </Card>
      </div>
    )
  }

  const contractors = [...state.contractors].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  )

  return (
    <div>
      {properties.map((p) => (
        <PropertyJobFeed
          key={p.id}
          propertyId={p.id}
          propertyLabel={p.address}
          onJobs={(pid, jobs) => setJobsByProperty((prev) => ({ ...prev, [pid]: jobs }))}
        />
      ))}

      <PageHeader
        title="Contractor Network"
        subtitle="One profile per contractor — contacts, trades, cadence, and work across every property, past and scheduled."
        action={<Button onClick={() => setEditing("new")}>+ Add contractor</Button>}
      />

      {totalUnlinked > 0 && (
        <div className="bg-brand-100 border border-line rounded-lg p-4 mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-2">
            {totalUnlinked} job{totalUnlinked === 1 ? "" : "s"} across the portfolio name a
            contractor by text but aren't linked to a network profile yet.
          </p>
          <Button variant="subtle" onClick={linkAll} disabled={linking === "all"}>
            {linking === "all" ? "Linking…" : "Link all matches"}
          </Button>
        </div>
      )}

      <div className="mb-4">
        <ImportPanel
          properties={properties}
          existingNames={contractors.map((c) => norm(c.name))}
          onImported={() => {}}
        />
      </div>

      {state.status === "loading" ? (
        <Card>
          <p className="text-sm text-ink-2">Loading network…</p>
        </Card>
      ) : contractors.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            No contractors in the network yet — import from property rosters above, or add one
            by hand.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {contractors.map((c) => {
            const jobs = allJobs.filter((j) => jobMatchesContractor(j, c))
            const homes = groupJobsByProperty(jobs)
            const unlinkedCount = unlinkedMatches(allJobs, c).length
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 w-full">
                    <p className="font-semibold text-ink">{c.name}</p>
                    <p className="text-sm text-ink-2">
                      {[c.trades, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {c.cadence && (
                      <p className="text-xs text-ink-3 mt-1">Cadence: {c.cadence}</p>
                    )}
                    {c.sourcing && (
                      <p className="text-xs text-ink-3">Sourced: {c.sourcing}</p>
                    )}
                    {c.notes && <p className="text-sm text-ink-2 mt-1.5">{c.notes}</p>}

                    {homes.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-ink-3 mb-1.5">
                          {homes.length} home{homes.length === 1 ? "" : "s"} served ·{" "}
                          {jobs.length} job{jobs.length === 1 ? "" : "s"} total
                        </p>
                        <div className="flex flex-col gap-2">
                          {homes.map((home) => (
                            <div key={home.propertyId} className="bg-plane rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-ink">
                                {home.propertyLabel}
                                <span className="font-normal text-ink-3">
                                  {" "}
                                  · {home.jobs.length} job{home.jobs.length === 1 ? "" : "s"}
                                </span>
                              </p>
                              <ul className="mt-1 flex flex-col gap-0.5">
                                {home.jobs.slice(0, 4).map((j) => (
                                  <li key={j.id} className="text-xs text-ink-2">
                                    {j.date ? `${j.date} · ` : ""}
                                    {j.title}
                                  </li>
                                ))}
                                {home.jobs.length > 4 && (
                                  <li className="text-xs text-ink-3">
                                    +{home.jobs.length - 4} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 mt-3 items-center flex-wrap">
                      <Button variant="ghost" className="!px-0" onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-0"
                        onClick={() => setConfirmDelete(c)}
                      >
                        Delete
                      </Button>
                      {unlinkedCount > 0 && (
                        <button
                          type="button"
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50"
                          disabled={linking === c.id}
                          onClick={() => linkJobs(c)}
                        >
                          {linking === c.id
                            ? "Linking…"
                            : `Link ${unlinkedCount} matching job${unlinkedCount === 1 ? "" : "s"}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add contractor" : "Edit contractor"}
          onClose={() => setEditing(null)}
        >
          <DynamicForm
            fields={fields}
            initialValues={editing === "new" ? {} : editing}
            onSubmit={(values) => {
              if (editing === "new") {
                addContractor(values)
              } else {
                updateContractor(editing.id, values)
              }
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete contractor?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.name}" from the network? This doesn't change any job history.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                removeContractor(confirmDelete.id)
                setConfirmDelete(null)
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
