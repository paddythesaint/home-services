import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { addItem } from "../firestoreApi"
import { Card, Button, ConditionBadge, DynamicForm } from "../components"
import PhotoSection from "../PhotoSection"

// Systems commonly present on large rural properties that the public-records
// seed can't see. Offered at the end of the walkthrough if not already listed.
const ADDITIONAL_SYSTEMS = [
  "Generator",
  "Pool / Hot Tub",
  "Irrigation System",
  "Fireplace & Chimney",
  "Sump Pump",
  "Water Treatment / Softener",
  "Garage Doors",
  "Gutters & Downspouts",
  "Attic & Insulation",
  "Windows & Doors",
  "Driveway",
  "Fencing & Gates",
  "Outbuildings / Barn",
]

const propertyFields = [
  { name: "address", label: "Address", type: "text" },
  { name: "areaLabel", label: "City / State / Zip", type: "text" },
  { name: "acreage", label: "Acreage", type: "number" },
  { name: "yearBuilt", label: "Year built", type: "number" },
  { name: "bedrooms", label: "Bedrooms", type: "number" },
  { name: "bathrooms", label: "Bathrooms", type: "number" },
  { name: "clientName", label: "Family / client name", type: "text" },
]

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function SystemStep({ uid, item, position, total, onConfirm, onRemove, onSkip }) {
  const [values, setValues] = useState({
    detail: item.detail || "",
    condition: item.condition || "good",
    brand: item.brand || "",
    installYear: item.installYear || "",
    lastServiced: item.lastServiced || "",
    location: item.location || "",
    note: item.note || "",
  })

  function set(name, value) {
    setValues((v) => ({ ...v, [name]: value }))
  }

  // Photo OCR suggestions land in the form; notes append rather than replace.
  function applySuggestion(fields) {
    setValues((v) => {
      const next = { ...v, ...fields }
      if (fields.note) next.note = v.note ? `${v.note}\n${fields.note}` : fields.note
      return next
    })
  }

  const inputClass = "border border-line rounded-md px-3 py-2 w-full"

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-lg font-semibold text-ink">{item.category}</h2>
        <span className="text-xs text-ink-3 shrink-0">
          System {position} of {total}
        </span>
      </div>
      <p className="text-sm text-ink-2 mb-4">
        Confirm what's right, correct what isn't, and fill in anything you can
        read off a nameplate or service sticker.
      </p>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Description</span>
          <input className={inputClass} value={values.detail} onChange={(e) => set("detail", e.target.value)} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-2">Brand / model</span>
            <input className={inputClass} value={values.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Trane XR16" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-2">Install year</span>
            <input className={inputClass} value={values.installYear} onChange={(e) => set("installYear", e.target.value)} placeholder="e.g. 2016" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-2">Last serviced</span>
            <input className={inputClass} value={values.lastServiced} onChange={(e) => set("lastServiced", e.target.value)} placeholder="e.g. March 2026" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-2">Location in home</span>
            <input className={inputClass} value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. basement utility room" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-2">Condition</span>
            <select className={inputClass} value={values.condition} onChange={(e) => set("condition", e.target.value)}>
              <option value="good">Good</option>
              <option value="attention">Attention</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-2">Notes</span>
          <textarea className={inputClass} rows={3} value={values.note} onChange={(e) => set("note", e.target.value)} />
        </label>

        <div className="pt-1">
          <PhotoSection uid={uid} systemId={item.id} onSuggest={applySuggestion} startOpen />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-line">
        <Button onClick={() => onConfirm(values)}>Confirm &amp; next</Button>
        <Button variant="subtle" onClick={onSkip}>Skip for now</Button>
        <Button variant="danger" onClick={onRemove}>
          Not applicable — remove
        </Button>
      </div>
    </Card>
  )
}

export default function Walkthrough() {
  const { uid, profile, saveProfile } = useOutletContext()
  const { items, loading, add, update, remove } = useItems(uid, "healthReport")

  // Snapshot the queue once so confirming/removing doesn't reshuffle steps.
  const [queue, setQueue] = useState(null)
  const [phase, setPhase] = useState("intro") // intro | basics | systems | additions | done
  const [queueIndex, setQueueIndex] = useState(0)
  const [checkedAdditions, setCheckedAdditions] = useState([])
  const [confirmedCount, setConfirmedCount] = useState(0)

  useEffect(() => {
    if (!loading && queue === null) {
      setQueue(items.map((i) => i.id))
    }
  }, [loading, items, queue])

  if (loading || queue === null) {
    return <p className="text-ink-2">Loading walkthrough…</p>
  }

  const existingCategories = new Set(items.map((i) => i.category.toLowerCase()))
  const additionOptions = ADDITIONAL_SYSTEMS.filter(
    (name) => !existingCategories.has(name.toLowerCase())
  )

  function advanceSystems() {
    let next = queueIndex + 1
    // Skip ids deleted outside this step
    while (next < queue.length && !items.some((i) => i.id === queue[next])) next++
    if (next >= queue.length) {
      setPhase("additions")
    } else {
      setQueueIndex(next)
    }
  }

  const currentItem =
    phase === "systems" ? items.find((i) => i.id === queue[queueIndex]) : null

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Property Walkthrough</h1>
        <p className="text-ink-2 mt-1">
          A guided survey to verify the property record — for the homeowner or a
          visiting technician. Everything saves as you go.
        </p>
      </div>

      {phase === "intro" && (
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-2">
            What this covers
          </h2>
          <ul className="text-sm text-ink-2 space-y-1.5 list-disc list-inside mb-4">
            <li>Confirm the property basics (acreage, year built, beds/baths)</li>
            <li>
              Walk each of the {queue.length} systems on record — confirm, correct,
              or remove, and capture brands, install years, and service dates
            </li>
            <li>Add systems the public-records seed couldn't see</li>
          </ul>
          <p className="text-sm text-ink-2 mb-4">
            Takes 10–20 minutes with the house in front of you. You can skip any
            system and come back later — progress saves item by item.
          </p>
          <Button onClick={() => setPhase("basics")}>Start walkthrough</Button>
        </Card>
      )}

      {phase === "basics" && (
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-1">
            Property basics
          </h2>
          <p className="text-sm text-ink-2 mb-4">
            These came from county records — correct anything that's off.
          </p>
          <DynamicForm
            fields={propertyFields}
            initialValues={profile}
            submitLabel="Confirm & continue"
            onSubmit={(values) => {
              saveProfile(values)
              setPhase(queue.length > 0 ? "systems" : "additions")
            }}
          />
        </Card>
      )}

      {phase === "systems" &&
        (currentItem ? (
          <SystemStep
            key={currentItem.id}
            uid={uid}
            item={currentItem}
            position={queueIndex + 1}
            total={queue.length}
            onConfirm={(values) => {
              update(currentItem.id, {
                ...values,
                verified: true,
                verifiedOn: todayLabel(),
              })
              addItem(uid, "activity", {
                systemId: currentItem.id,
                type: "service",
                summary: "Confirmed during walkthrough",
                source: { type: "walkthrough", label: "walkthrough" },
                date: todayLabel(),
                order: Date.now(),
              })
              setConfirmedCount((c) => c + 1)
              advanceSystems()
            }}
            onRemove={() => {
              remove(currentItem.id)
              advanceSystems()
            }}
            onSkip={advanceSystems}
          />
        ) : (
          // Current id vanished (deleted elsewhere) — move along.
          advanceSystems() ?? null
        ))}

      {phase === "additions" && (
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-1">
            Anything we missed?
          </h2>
          <p className="text-sm text-ink-2 mb-4">
            Check everything present on the property — each becomes a system on
            the Health Report with its details ready to fill in.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {additionOptions.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={checkedAdditions.includes(name)}
                  onChange={(e) =>
                    setCheckedAdditions((list) =>
                      e.target.checked
                        ? [...list, name]
                        : list.filter((n) => n !== name)
                    )
                  }
                />
                {name}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={async () => {
                for (const name of checkedAdditions) {
                  await add({
                    category: name,
                    detail: "Added during walkthrough",
                    condition: "good",
                    note: "Fill in brand, age, and condition details.",
                    verified: true,
                    verifiedOn: todayLabel(),
                  })
                }
                saveProfile({ walkthroughCompletedOn: todayLabel() })
                setPhase("done")
              }}
            >
              {checkedAdditions.length > 0
                ? `Add ${checkedAdditions.length} & finish`
                : "Finish walkthrough"}
            </Button>
          </div>
        </Card>
      )}

      {phase === "done" && (
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-2">
            Walkthrough complete <ConditionBadge condition="good" />
          </h2>
          <p className="text-sm text-ink-2 mb-1">
            {confirmedCount} system{confirmedCount === 1 ? "" : "s"} confirmed
            {checkedAdditions.length > 0 &&
              `, ${checkedAdditions.length} added`}
            . Verified systems now carry a badge on the Health Report.
          </p>
          <p className="text-sm text-ink-2 mb-4">
            Skipped systems stay unverified — run the walkthrough again anytime
            to pick them up.
          </p>
          <div className="flex gap-3">
            <Link to="/health-report">
              <Button>View Health Report</Button>
            </Link>
            <Link to="/">
              <Button variant="subtle">Back to overview</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
