import { useEffect, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { callClaude, assistantTools, buildSystemPrompt } from "../assistantApi"
import { compressImage } from "../photoUtils"
import { addPhoto, addItem } from "../firestoreApi"
import { todayLabel, todayISO, addMonthsISO } from "../dates"
import { Card, Button } from "../components"

// The API requires every assistant tool_use block to be answered by a
// tool_result in the very next message — one dangling pair poisons the whole
// conversation (every later send 400s). A turn can legitimately end dangling:
// the response hit max_tokens before the loop executed the tools, or a network
// failure interrupted a multi-round turn. Patch those with synthetic error
// results (never executing a possibly-truncated call) so history stays
// sendable. Consecutive same-role messages are fine — the API merges them.
function repairDanglingToolUses(messages) {
  const out = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    out.push(msg)
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue
    const ids = msg.content.filter((b) => b.type === "tool_use").map((b) => b.id)
    if (ids.length === 0) continue
    const next = messages[i + 1]
    const answered = Array.isArray(next?.content)
      ? next.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id)
      : []
    const missing = ids.filter((id) => !answered.includes(id))
    if (missing.length === 0) continue
    out.push({
      role: "user",
      content: missing.map((id) => ({
        type: "tool_result",
        tool_use_id: id,
        is_error: true,
        content:
          "This tool call was interrupted and never ran. Re-issue it if it's still needed.",
      })),
    })
  }
  return out
}

// Image bytes stay out of persisted history — facts were already extracted
// the turn they were sent, and resending photos every turn balloons cost.
function stripImages(messages) {
  return messages.map((m) =>
    Array.isArray(m.content)
      ? {
          ...m,
          content: m.content.map((b) =>
            b.type === "image" ? { type: "text", text: "[photo was attached here]" } : b
          ),
        }
      : m
  )
}

const GREETING =
  "Hi — I'm your property assistant. Tell me about any part of the house and I'll record it as we talk: \"the water heater is a 2019 Rheem in the garage\", \"we had the septic pumped last fall\", \"what should I check next?\" You can also snap a photo of any nameplate or piece of equipment with the camera button and I'll read it. Where do you want to start — or should I pick the biggest gap in the record?"

function KeySetup({ onSave }) {
  const [value, setValue] = useState("")
  return (
    <Card className="max-w-xl">
      <h2 className="text-base font-semibold text-ink mb-2">
        One-time setup: connect Claude
      </h2>
      <p className="text-sm text-ink-2 mb-3">
        The assistant is powered by the Claude API using your own key, since
        this site has no server to hold one. Your key is stored in your
        private property record (owner-only, same protection as everything
        else here) and calls go straight from your browser to Anthropic.
      </p>
      <ol className="text-sm text-ink-2 list-decimal list-inside space-y-1 mb-4">
        <li>
          Go to{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 underline"
          >
            console.anthropic.com → API Keys
          </a>{" "}
          (create an account if needed and add ~$5 of credit)
        </li>
        <li>Create a key and copy it (starts with "sk-ant-")</li>
        <li>Paste it below</li>
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim().startsWith("sk-ant-")) onSave(value.trim())
        }}
      >
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-…"
          className="flex-1 border border-line rounded-lg px-3 py-2 bg-surface text-ink"
        />
        <Button type="submit">Save key</Button>
      </form>
      <p className="text-xs text-ink-3 mt-3">
        An intake conversation typically costs a few cents.
      </p>
    </Card>
  )
}

export default function Assistant() {
  const { uid, profile, saveProfile } = useOutletContext()
  const healthApi = useItems(uid, "healthReport")
  const priorityApi = useItems(uid, "priorityList")
  const jobApi = useItems(uid, "jobHistory")
  const calendarApi = useItems(uid, "careCalendar")

  const [uiMessages, setUiMessages] = useState([
    { role: "assistant", text: GREETING },
  ])
  const [apiMessages, setApiMessages] = useState([])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState([]) // attached photo dataUrls, not yet sent
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const turnPhotosRef = useRef([]) // photos in the message currently being processed

  async function attachFiles(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ""
    for (const file of files.slice(0, 3)) {
      try {
        const dataUrl = await compressImage(file)
        setPending((p) => [...p, dataUrl])
      } catch (err) {
        console.error(err)
      }
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [uiMessages, busy])

  async function executeTool(name, args) {
    switch (name) {
      case "update_system": {
        const fields = { ...args.fields }
        if (fields.verified) fields.verifiedOn = todayLabel()
        await healthApi.update(args.id, fields)
        const item = healthApi.items.find((i) => i.id === args.id)
        return `Updated ${item?.category || "system"}`
      }
      case "add_system":
        await healthApi.add({ condition: "good", note: "", ...args })
        return `Added ${args.category}`
      case "remove_system": {
        const item = healthApi.items.find((i) => i.id === args.id)
        await healthApi.remove(args.id)
        return `Removed ${item?.category || "system"}`
      }
      case "add_job":
        await jobApi.add({ category: "", sub: "—", cost: "—", notes: "", ...args })
        return `Logged job: ${args.title}`
      case "add_priority":
        await priorityApi.add({ category: "", reason: "", estCost: "", ...args })
        return `Added priority: ${args.title}`
      case "update_priority":
        await priorityApi.update(args.id, args.fields)
        return "Updated priority"
      case "resolve_priority": {
        await priorityApi.update(args.id, {
          status: args.status,
          resolvedOn: todayLabel(),
          resolutionNote: args.note || "",
        })
        const item = priorityApi.items.find((i) => i.id === args.id)
        return `${args.status[0].toUpperCase()}${args.status.slice(1)}: ${item?.title || "priority"}`
      }
      case "log_activity": {
        await addItem(uid, "activity", {
          systemId: args.systemId,
          type: args.type,
          summary: args.summary,
          ...(args.value ? { value: args.value } : {}),
          ...(args.unit ? { unit: args.unit } : {}),
          date: todayLabel(),
          order: Date.now(),
        })
        const item = healthApi.items.find((i) => i.id === args.systemId)
        const valStr = args.value ? ` (${args.value}${args.unit ? " " + args.unit : ""})` : ""
        return `Logged to ${item?.category || "system"}: ${args.summary}${valStr}`
      }
      case "set_recurring_check": {
        const freq = Number(args.frequencyMonths) || 0
        const patch = { verifyFrequencyMonths: String(freq) }
        if (freq > 0 && args.markCheckedNow) {
          patch.verified = true
          patch.verifiedOn = todayLabel()
          patch.lastVerified = todayISO()
          patch.nextDue = addMonthsISO(freq)
          await addItem(uid, "activity", {
            systemId: args.systemId,
            type: "service",
            summary: "Verified / checked",
            date: todayLabel(),
            order: Date.now(),
          })
        } else if (freq === 0) {
          patch.nextDue = ""
        }
        await healthApi.update(args.systemId, patch)
        const item = healthApi.items.find((i) => i.id === args.systemId)
        return freq === 0
          ? `Removed recurring check on ${item?.category || "system"}`
          : `Set ${item?.category || "system"} to check every ${freq} month${freq === 1 ? "" : "s"}`
      }
      case "remove_priority": {
        const item = priorityApi.items.find((i) => i.id === args.id)
        await priorityApi.remove(args.id)
        return `Removed priority: ${item?.title || ""}`
      }
      case "add_calendar_task":
        await calendarApi.add(args)
        return `Calendar: ${args.task} (${args.month})`
      case "save_photo": {
        const photos = turnPhotosRef.current
        if (photos.length === 0) return "No photo attached to file"
        for (const dataUrl of photos) {
          await addPhoto(uid, {
            systemId: args.systemId,
            dataUrl,
            takenOn: todayLabel(),
            order: Date.now(),
          })
        }
        const item = healthApi.items.find((i) => i.id === args.systemId)
        return `Filed ${photos.length} photo${photos.length > 1 ? "s" : ""} under ${item?.category || "system"}`
      }
      case "update_property":
        await saveProfile(args.fields)
        return "Updated property info"
      default:
        throw new Error(`Unknown tool ${name}`)
    }
  }

  async function send() {
    const text = input.trim()
    const photos = pending
    if ((!text && photos.length === 0) || busy) return
    setInput("")
    setPending([])
    turnPhotosRef.current = photos
    setBusy(true)
    setUiMessages((m) => [...m, { role: "user", text, images: photos }])

    const content =
      photos.length > 0
        ? [
            ...photos.map((dataUrl) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: dataUrl.split(",")[1],
              },
            })),
            { type: "text", text: text || "Here's a photo — what do you see?" },
          ]
        : text

    let messages = repairDanglingToolUses([...apiMessages, { role: "user", content }])
    const system = buildSystemPrompt({
      profile,
      systems: healthApi.items,
      priorities: priorityApi.items,
      jobs: jobApi.items,
      calendar: calendarApi.items,
    })

    try {
      for (let round = 0; round < 6; round++) {
        const data = await callClaude(
          profile.anthropicApiKey,
          system,
          messages,
          assistantTools
        )
        messages = [...messages, { role: "assistant", content: data.content }]

        for (const block of data.content) {
          if (block.type === "text" && block.text.trim()) {
            setUiMessages((m) => [...m, { role: "assistant", text: block.text }])
          }
        }

        const toolUses = data.content.filter((b) => b.type === "tool_use")
        if (data.stop_reason !== "tool_use" || toolUses.length === 0) break

        const results = []
        for (const tu of toolUses) {
          try {
            const summary = await executeTool(tu.name, tu.input)
            setUiMessages((m) => [...m, { role: "action", text: summary }])
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: summary,
            })
          } catch (err) {
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: `Error: ${err.message}`,
              is_error: true,
            })
          }
        }
        messages = [...messages, { role: "user", content: results }]
      }
      // Repair covers the turn ending with unanswered tool_use — e.g. the
      // round cap was hit, or stop_reason wasn't "tool_use" (max_tokens cut
      // the response off) while tool_use blocks were present.
      setApiMessages(stripImages(repairDanglingToolUses(messages)))
    } catch (err) {
      console.error(err)
      // Persist what succeeded before the failure: earlier rounds may have
      // already executed tools and written to the record, so keeping the
      // (repaired) partial history keeps the conversation consistent with it.
      setApiMessages(stripImages(repairDanglingToolUses(messages)))
      setUiMessages((m) => [
        ...m,
        {
          role: "error",
          text: err.message.includes("401")
            ? "That API key was rejected — double-check it in Settings below."
            : `Something went wrong: ${err.message}`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  if (!profile.anthropicApiKey) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-ink tracking-tight">
            Intake Assistant
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            A conversational way to build out your property record — no forms,
            no fixed order.
          </p>
        </div>
        <KeySetup onSave={(key) => saveProfile({ anthropicApiKey: key })} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-ink tracking-tight">
            Intake Assistant
          </h1>
          <p className="text-sm text-ink-2 mt-0.5">
            Everything you tell it is saved to the record as you talk.
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-ink-3 hover:text-ink underline shrink-0"
          onClick={() => saveProfile({ anthropicApiKey: "" })}
        >
          Change API key
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-surface border border-line rounded-xl p-4 flex flex-col gap-3"
      >
        {uiMessages.map((msg, i) =>
          msg.role === "action" ? (
            <div key={i} className="self-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 bg-brand-100 rounded-full px-3 py-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" stroke="var(--color-status-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {msg.text}
              </span>
            </div>
          ) : (
            <div
              key={i}
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "self-end bg-brand-700 text-white"
                  : msg.role === "error"
                    ? "self-start bg-red-50 text-red-700 border border-red-200"
                    : "self-start bg-plane text-ink"
              }`}
            >
              {msg.images?.length > 0 && (
                <div className="flex gap-1.5 mb-1.5">
                  {msg.images.map((src, j) => (
                    <img
                      key={j}
                      src={src}
                      alt="Attached"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}
              {msg.text}
            </div>
          )
        )}
        {busy && (
          <div className="self-start text-sm text-ink-3 px-3.5 py-2.5">
            Thinking…
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="flex gap-2 mt-3">
          {pending.map((src, i) => (
            <div key={i} className="relative">
              <img
                src={src}
                alt="Ready to send"
                className="w-16 h-16 object-cover rounded-lg border border-line"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-line text-ink-2 hover:text-red-600 text-xs leading-none"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={attachFiles}
        />
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          disabled={busy}
          aria-label="Attach photo"
          className="shrink-0 border border-line rounded-lg px-3 bg-surface text-ink-2 hover:text-ink disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me about the house…"
          className="flex-1 border border-line rounded-lg px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || (!input.trim() && pending.length === 0)}>
          Send
        </Button>
      </form>
    </div>
  )
}
