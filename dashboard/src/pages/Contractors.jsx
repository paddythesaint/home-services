import { useMemo, useState } from "react"
import { RecordTabs } from "../HubTabs"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { viewFor } from "../roles"
import { Card, PageHeader, Button, Modal, DynamicForm } from "../components"

const fields = [
  { name: "name", label: "Name", type: "text" },
  { name: "trades", label: "Trades", type: "text", placeholder: "e.g. HVAC, Roofing" },
  { name: "phone", label: "Phone", type: "text", placeholder: "e.g. (434) 246-7111" },
  {
    name: "sourcing",
    label: "How sourced",
    type: "text",
    placeholder: "e.g. Prior owner, referral, insurance-assigned",
  },
  { name: "notes", label: "Notes", type: "textarea" },
]

const norm = (s) => (s || "").trim().toLowerCase()
// Matches "(434) 246-7111" as a unit, or a bare "434-227-4666" (even when the
// source wrapped it in parens) without swallowing those parens into the number.
const PHONE = /\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4}/

// A job's "sub" field is free text — sometimes a real contractor
// ("Monticello Air — (434) 246-7111"), sometimes not ("Per paint schedule").
// Skip the obvious non-contractors so import doesn't create junk.
function looksLikeContractor(sub) {
  const s = norm(sub)
  if (!s || s === "—") return false
  return !/^(per |seller|tbd|installed)/.test(s) && !s.includes("schedule") && !s.includes("pre-closing")
}

function parseCandidate(sub) {
  const phoneMatch = sub.match(PHONE)
  const phone = phoneMatch ? phoneMatch[0].trim() : ""
  const name = sub
    .replace(PHONE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[—\-/·,()\s]+$/, "")
    .replace(/^[—\-/·,()\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  return { name, phone }
}

// Roll job-history subs up into distinct contractor candidates, skipping any
// already in the roster. Merges duplicates (with/without phone), collects the
// job categories they worked as their trades, and counts jobs.
function buildCandidates(jobs, existing) {
  const have = new Set(existing.map((c) => norm(c.name)))
  const byName = new Map()
  for (const job of jobs) {
    if (!looksLikeContractor(job.sub)) continue
    const { name, phone } = parseCandidate(job.sub)
    if (!name || have.has(norm(name))) continue
    const key = norm(name)
    const entry = byName.get(key) || { name, phone: "", trades: new Set(), jobs: 0 }
    if (phone && !entry.phone) entry.phone = phone
    if (job.category) entry.trades.add(job.category)
    entry.jobs += 1
    byName.set(key, entry)
  }
  return [...byName.values()]
    .map((e) => ({ ...e, trades: [...e.trades].join(", ") }))
    .sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name))
}

function ImportModal({ candidates, onClose, onImport }) {
  const [selected, setSelected] = useState(() => new Set(candidates.map((c) => c.name)))
  const toggle = (name) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  return (
    <Modal title="Import contractors from job history" onClose={onClose}>
      <p className="text-sm text-ink-2 mb-4">
        We found these vendors named in your job history. Pick the ones to add as
        contractor records — you can edit or delete any of them afterward.
      </p>
      <ul className="divide-y divide-line mb-4">
        {candidates.map((c) => (
          <li key={c.name} className="py-2.5 flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 accent-brand-700"
              checked={selected.has(c.name)}
              onChange={() => toggle(c.name)}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{c.name}</p>
              <p className="text-xs text-ink-3">
                {[c.trades, c.phone, `${c.jobs} job${c.jobs === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => onImport(candidates.filter((c) => selected.has(c.name)))}
          disabled={selected.size === 0}
        >
          Import {selected.size || ""}
        </Button>
      </div>
    </Modal>
  )
}

export default function Contractors() {
  const { uid, user } = useOutletContext()
  const founder = viewFor(user?.email).business
  const { items: contractors, add, update, remove } = useItems(uid, "contractors")
  const { items: jobs } = useItems(uid, "jobHistory")
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [importing, setImporting] = useState(false)

  const candidates = useMemo(() => buildCandidates(jobs, contractors), [jobs, contractors])

  // Jobs whose free-text sub names this contractor — their track record.
  const jobsFor = (c) => jobs.filter((j) => norm(j.sub).includes(norm(c.name)))

  const ordered = [...contractors].sort((a, b) => (a.name || "").localeCompare(b.name || ""))

  async function importSelected(picked) {
    for (const c of picked) {
      await add({
        name: c.name,
        trades: c.trades || "",
        phone: c.phone || "",
        sourcing: "",
        notes: "Imported from job history",
      })
    }
    setImporting(false)
  }

  return (
    <div>
      <RecordTabs />
      <PageHeader
        title="Contractors"
        subtitle="Your trusted network — every vendor who has worked on the property, with trades, contact info, and job history."
        action={<Button onClick={() => setEditing("new")}>+ Add contractor</Button>}
      />

      {candidates.length > 0 && (
        <div className="bg-brand-100 border border-line rounded-lg p-4 mb-5 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-2">
            {candidates.length} vendor{candidates.length === 1 ? "" : "s"} named in your
            job history {candidates.length === 1 ? "isn't" : "aren't"} in your roster yet.
          </p>
          <Button variant="subtle" onClick={() => setImporting(true)}>
            Import from jobs
          </Button>
        </div>
      )}

      {ordered.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-2">
            No contractors yet.{" "}
            {candidates.length > 0
              ? "Import them from your job history above, or add one by hand."
              : "Add your first vendor, and they'll build up as jobs are logged."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((c) => {
            const jobList = jobsFor(c)
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {c.name}
                      {c.networkId && (
                        <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide bg-brand-100 text-brand-900 rounded-full px-2 py-0.5">
                          HPS vendor
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-ink-2">
                      {[c.trades, c.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {c.sourcing && (
                      <p className="text-xs text-ink-3 mt-1">Sourced: {c.sourcing}</p>
                    )}
                    {c.notes && <p className="text-sm text-ink-2 mt-1.5">{c.notes}</p>}
                    {jobList.length > 0 && (
                      <div className="mt-2.5">
                        <p className="text-xs font-medium text-ink-3">
                          {jobList.length} job{jobList.length === 1 ? "" : "s"} on record
                        </p>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {jobList.slice(0, 4).map((j) => (
                            <li key={j.id} className="text-xs text-ink-2">
                              {j.date ? `${j.date} · ` : ""}
                              {j.title}
                            </li>
                          ))}
                          {jobList.length > 4 && (
                            <li className="text-xs text-ink-3">
                              +{jobList.length - 4} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-3 mt-3 items-center">
                      {c.networkId && !founder ? (
                        // Network-linked entries follow the master profile —
                        // contact details stay current without homeowner upkeep.
                        <span className="text-xs text-ink-3">
                          Contact details managed by your service team
                        </span>
                      ) : (
                        <Button variant="ghost" className="!px-0" onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        className="!px-0"
                        onClick={() => setConfirmDelete(c)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {importing && (
        <ImportModal
          candidates={candidates}
          onClose={() => setImporting(false)}
          onImport={importSelected}
        />
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
                add(values)
              } else {
                update(editing.id, values)
              }
              setEditing(null)
            }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete contractor?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-ink-2 mb-4">
            Remove "{confirmDelete.name}" from your roster? This doesn't change any job
            history.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(confirmDelete.id)
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
