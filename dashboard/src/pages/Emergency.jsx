import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { emergencyShutoffs, emergencyContacts } from "../emergency"
import { TEAM } from "../team"
import { PageHeader } from "../components"

const TEAM_NAMES = TEAM.map((t) => t.name).join(" and ")

// The Emergency Card: one calm page for the worst moment — what to shut
// off and who to call, in type big enough to read while the water rises.
// Everything derives from the record; there is nothing here to maintain.

export default function Emergency() {
  const { uid, profile } = useOutletContext()
  const { items: facts } = useItems(uid, "facts")
  const { items: systems } = useItems(uid, "healthReport")
  const { items: contractors } = useItems(uid, "contractors")

  const groups = emergencyShutoffs(facts, systems)
  const contacts = emergencyContacts(contractors)

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title="If something goes wrong, start here."
        clause="Shutoffs first, then call us."
        subtitle={`${profile.address} — kept current from your home's record.`}
      />

      <p className="m-0 mb-8 text-sm font-medium text-status-critical">
        Life-threatening emergency, fire, or a strong gas smell — 911 first, always.
      </p>

      {groups.length === 0 ? (
        <div className="bg-sunk rounded-(--radius-block) p-6 mb-8">
          <p className="m-0 text-sm text-ink-2">
            We capture shutoff locations during our visits — they'll appear here as the
            record fills in. Anything urgent right now: call or text us directly below.
          </p>
        </div>
      ) : (
        <div className="mb-10 flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="flex items-baseline justify-between gap-3 border-t border-rule pt-2.5">
                <h2 className="m-0 font-display text-[20px] text-ink">{g.label}</h2>
                <p className="m-0 text-[12.5px] text-ink-3 text-right">{g.hint}</p>
              </div>
              <ul className="m-0 mt-2 p-0 list-none">
                {g.entries.map((e, i) => (
                  <li key={i} className="py-2 border-t border-line last:border-b-0">
                    <p className="m-0 text-[16px] leading-[1.5] text-ink">{e.text}</p>
                    <p className="numeric m-0 mt-0.5 text-[10.5px] uppercase tracking-wide text-ink-3">
                      {e.source}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section>
        <div className="border-t border-rule pt-2.5">
          <h2 className="m-0 font-display text-[20px] text-ink">Who to call</h2>
        </div>
        <ul className="m-0 mt-2 p-0 list-none">
          {contacts.map((c) => (
            <li
              key={c.name}
              className="py-2.5 border-t border-line flex items-baseline justify-between gap-4"
            >
              <span>
                <span className="text-[16px] font-medium text-ink">{c.name}</span>
                <span className="block text-[12.5px] text-ink-3">
                  {c.team ? c.role : `Our designated ${c.role.toLowerCase()} pro`}
                </span>
              </span>
              {c.phone ? (
                <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="numeric text-[15px] text-brand-700 shrink-0">
                  {c.phone}
                </a>
              ) : c.email ? (
                // No number on file yet — email is still one tap, not a
                // dead "call us" with nothing to press.
                <a href={`mailto:${c.email}`} className="text-[13px] font-medium text-brand-700 shrink-0">
                  Email now
                </a>
              ) : (
                <span className="text-[12.5px] text-ink-3 shrink-0">via the team</span>
              )}
            </li>
          ))}
        </ul>
        <p className="m-0 mt-4 text-[12.5px] text-ink-3">
          Reach {TEAM_NAMES} any time — anything urgent, we see it right away.
        </p>
      </section>
    </div>
  )
}
