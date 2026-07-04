import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import {
  subscribeContractors,
  addContractor,
  fetchPropertyContractors,
  fetchMemberProperties,
  updateItem,
} from "../firestoreApi"
import { viewFor } from "../roles"
import { norm, jobMatchesContractor, unlinkedMatches } from "../contractorMatching"
import { contractorFields } from "../contractorShared"
import { PropertyJobFeed } from "../PortfolioJobs"
import { DIRECTORY_COUNT, directoryCandidates } from "../contractorDirectory"
import { Card, PageHeader, Button, Modal, DynamicForm } from "../components"

// The founder-researched Charlottesville directory (contractorDirectory.js):
// browse by trade, tick, add as real network profiles. Deduped by name
// against the live network, so it's re-openable any time without doubles.
function DirectoryPanel({ existingNames }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const candidates = directoryCandidates(existingNames)
  const remaining = candidates.reduce((n, c) => n + c.providers.length, 0)

  const toggle = (name) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  async function addSelected() {
    setAdding(true)
    let n = 0
    for (const cat of candidates) {
      for (const p of cat.providers) {
        if (!selected.has(p.name)) continue
        await addContractor(p)
        n += 1
      }
    }
    setAddedCount(n)
    setSelected(new Set())
    setAdding(false)
  }

  if (!open) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-ink-2">
            Charlottesville contractor directory — {DIRECTORY_COUNT} researched providers
            across {remaining > 0 ? "10 trades" : "every trade"}, ready to add to the
            network.{" "}
            {addedCount > 0 && (
              <span className="font-medium text-ink">Added {addedCount}.</span>
            )}
          </p>
          <Button variant="subtle" onClick={() => setOpen(true)} disabled={remaining === 0}>
            {remaining === 0 ? "All added" : "Browse directory"}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Charlottesville directory">
      <p className="text-xs text-ink-3 mb-2">
        Researched from public sources, July 2026 — every entry is tagged "verify contact
        before first use." Providers already in the network aren't shown.
      </p>
      <div className="max-h-96 overflow-y-auto pr-1">
        {candidates.map((cat) => (
          <div key={cat.category} className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-1">
              {cat.category}
            </p>
            <ul className="divide-y divide-line">
              {cat.providers.map((p) => (
                <li key={p.name} className="py-1.5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 accent-brand-700"
                    checked={selected.has(p.name)}
                    onChange={() => toggle(p.name)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink-3">
                      {[p.phone, p.email, p.website && "website"].filter(Boolean).join(" · ") ||
                        "contact via website"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-line">
        <Button variant="subtle" onClick={() => setOpen(false)}>
          Close
        </Button>
        <Button onClick={addSelected} disabled={adding || selected.size === 0}>
          {adding ? "Adding…" : `Add ${selected.size || ""} to network`}
        </Button>
      </div>
    </Card>
  )
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
  const founder = viewFor(user?.email).business

  const [state, setState] = useState({ status: "loading", contractors: [] })
  const [properties, setProperties] = useState([])
  const [jobsByProperty, setJobsByProperty] = useState({})
  const [adding, setAdding] = useState(false)
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
        action={<Button onClick={() => setAdding(true)}>+ Add contractor</Button>}
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

      <div className="mb-4 flex flex-col gap-3">
        <DirectoryPanel existingNames={contractors.map((c) => c.name)} />
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
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-line">
                  <th className="py-2 pr-4 font-semibold">Contractor</th>
                  <th className="py-2 pr-4 font-semibold">Trades</th>
                  <th className="py-2 pr-4 font-semibold">Contact</th>
                  <th className="py-2 pr-4 font-semibold">Cadence</th>
                  <th className="py-2 pr-4 font-semibold">Last job</th>
                  <th className="py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {contractors.map((c) => {
                  const jobs = allJobs.filter((j) => jobMatchesContractor(j, c))
                  const homeCount = new Set(jobs.map((j) => j.propertyId)).size
                  const lastJob = jobs.reduce(
                    (a, j) => (!a || (j.order || 0) > (a.order || 0) ? j : a),
                    null
                  )
                  const unlinkedCount = unlinkedMatches(allJobs, c).length
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="py-2.5 pr-4">
                        <Link
                          to={`/contractor-network/${c.id}`}
                          className="font-medium text-brand-600 hover:text-brand-800"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-ink-3">
                          {homeCount} home{homeCount === 1 ? "" : "s"} · {jobs.length} job
                          {jobs.length === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-ink-2">{c.trades || "—"}</td>
                      <td className="py-2.5 pr-4 text-ink-2">
                        <p>{c.phone || ""}</p>
                        <p className="text-xs text-ink-3 break-all">
                          {c.email || ""}
                          {c.email && c.website ? " · " : ""}
                          {c.website && (
                            <a
                              href={c.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-600 hover:text-brand-800 underline"
                            >
                              website
                            </a>
                          )}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-ink-2 whitespace-nowrap">
                        {c.cadence || "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-ink-2 whitespace-nowrap">
                        {lastJob ? lastJob.date || "logged" : "—"}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {unlinkedCount > 0 && (
                          <button
                            type="button"
                            className="text-xs text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50"
                            disabled={linking === c.id}
                            onClick={() => linkJobs(c)}
                          >
                            {linking === c.id
                              ? "Linking…"
                              : `Link ${unlinkedCount} job${unlinkedCount === 1 ? "" : "s"}`}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-3 mt-3">
            Click a contractor's name for their full profile — contacts, notes, and work
            history by home, plus edit and delete.
          </p>
        </Card>
      )}

      {adding && (
        <Modal title="Add contractor" onClose={() => setAdding(false)}>
          <DynamicForm
            fields={contractorFields}
            initialValues={{}}
            onSubmit={(values) => {
              addContractor(values)
              setAdding(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
