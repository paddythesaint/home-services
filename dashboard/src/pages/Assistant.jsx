import { useEffect, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { callClaude, assistantTools, buildSystemPrompt } from "../assistantApi"
import { Card, Button } from "../components"

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const GREETING =
  "Hi — I'm your property assistant. Tell me about any part of the house and I'll record it as we talk: \"the water heater is a 2019 Rheem in the garage\", \"we had the septic pumped last fall\", \"what should I check next?\" Where do you want to start — or should I pick the biggest gap in the record?"

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
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

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
      case "remove_priority": {
        const item = priorityApi.items.find((i) => i.id === args.id)
        await priorityApi.remove(args.id)
        return `Removed priority: ${item?.title || ""}`
      }
      case "add_calendar_task":
        await calendarApi.add(args)
        return `Calendar: ${args.task} (${args.month})`
      case "update_property":
        await saveProfile(args.fields)
        return "Updated property info"
      default:
        throw new Error(`Unknown tool ${name}`)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    setBusy(true)
    setUiMessages((m) => [...m, { role: "user", text }])

    let messages = [...apiMessages, { role: "user", content: text }]
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
      setApiMessages(messages)
    } catch (err) {
      console.error(err)
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

      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me about the house…"
          className="flex-1 border border-line rounded-lg px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
