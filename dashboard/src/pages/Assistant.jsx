import { useRef, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { addItem } from "../firestoreApi"
import { callClaude } from "../backendApi"
import { compressImage } from "../photoUtils"
import { uploadDocument, MAX_DOC_BYTES } from "../storageApi"
import { todayLabel } from "../dates"
import {
  buildAssistantContext,
  assistantSystemPrompt,
  parseAssistantReply,
  transcriptMessage,
} from "../assistant"
import { Card, PageHeader, Button } from "../components"

// The 24/7 concierge: knows this home's record (and nothing else), answers
// from it, files service requests, and learns — every fact saved here came
// through a confirm chip the member tapped. Transcripts are stored on the
// property and visible to the whole household and the HPS team.

function ActionChip({ action, onConfirm }) {
  if (action.status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-3 py-1.5">
        ✓ {action.type === "save_fact" ? "Saved to the record" : "Request filed — see Happening now"}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 bg-plane border border-line rounded-xl px-3 py-2">
      <span className="text-xs text-ink-2">
        {action.type === "save_fact" ? `Record: "${action.fact}"` : `File request: "${action.title}"`}
      </span>
      <Button variant="subtle" className="!py-1 !px-3 !text-xs shrink-0" onClick={onConfirm}>
        {action.type === "save_fact" ? "Save" : "Send request"}
      </Button>
    </span>
  )
}

export default function Assistant() {
  const { uid, profile, user } = useOutletContext()
  const { items: systems } = useItems(uid, "healthReport")
  const { items: priorities } = useItems(uid, "priorityList")
  const { items: calendar } = useItems(uid, "careCalendar")
  const { items: jobs } = useItems(uid, "jobHistory")
  const { items: workOrders } = useItems(uid, "workOrders")
  const factsApi = useItems(uid, "facts")
  const convApi = useItems(uid, "conversations")
  const { items: documents } = useItems(uid, "documents")

  const [messages, setMessages] = useState([]) // {role, text, hadPhoto?, actions?}
  const [input, setInput] = useState("")
  const [photo, setPhoto] = useState(null) // dataUrl pending attach
  const [doc, setDoc] = useState(null) // {file, base64} pending attach
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [openConv, setOpenConv] = useState(null)
  const convIdRef = useRef(null)
  const fileRef = useRef(null)
  const docRef = useRef(null)

  // The running API-shaped history (may include image blocks; kept out of
  // React state so transcripts never carry base64).
  const apiHistoryRef = useRef([])

  async function persist(next) {
    const record = {
      startedBy: user?.email || "",
      startedOn: todayLabel(),
      summary: next.find((m) => m.role === "user")?.text.slice(0, 80) || "Conversation",
      messages: next.map(transcriptMessage),
    }
    if (convIdRef.current) {
      await convApi.update(convIdRef.current, record)
    } else {
      const ref = await convApi.add(record)
      convIdRef.current = ref.id
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setError("")
    setSending(true)
    const userMsg = { role: "user", text, hadPhoto: Boolean(photo), hadDoc: doc?.file?.name }
    const shown = [...messages, userMsg]
    setMessages(shown)
    setInput("")

    let content = text
    if (photo) {
      content = [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: photo.split(",")[1] },
        },
        { type: "text", text },
      ]
    } else if (doc) {
      content = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: doc.base64 },
        },
        { type: "text", text },
      ]
    }
    apiHistoryRef.current = [...apiHistoryRef.current, { role: "user", content }]
    setPhoto(null)
    const pendingDoc = doc
    setDoc(null)
    if (pendingDoc) {
      // File it on the property regardless of what the model says about it.
      try {
        await uploadDocument(uid, pendingDoc.file, user?.email)
      } catch {
        setError(
          "The document was read but couldn't be filed to storage — if this persists, the Storage rules may need publishing (see System status)."
        )
      }
    }

    try {
      const context = buildAssistantContext({
        profile,
        systems,
        priorities,
        calendar,
        jobs,
        workOrders,
        facts: factsApi.items,
      })
      const data = await callClaude(
        uid,
        assistantSystemPrompt(context),
        apiHistoryRef.current
      )
      const raw = data.content?.find((b) => b.type === "text")?.text || ""
      apiHistoryRef.current = [...apiHistoryRef.current, { role: "assistant", content: raw }]
      const { text: replyText, actions } = parseAssistantReply(raw)
      const next = [...shown, { role: "assistant", text: replyText, actions }]
      setMessages(next)
      await persist(next)
    } catch (err) {
      setError(err.message || "The assistant couldn't be reached — the team can, though.")
    }
    setSending(false)
  }

  async function confirmAction(msgIndex, actionIndex) {
    const msg = messages[msgIndex]
    const action = msg.actions[actionIndex]
    if (action.type === "save_fact") {
      await factsApi.add({
        text: action.fact,
        category: action.category || "",
        source: "assistant",
        confirmedBy: user?.email || "",
        date: todayLabel(),
      })
    } else if (action.type === "service_request") {
      await addItem(uid, "workOrders", {
        title: action.title,
        notes: action.details || "",
        category: "",
        lane: "triage",
        source: "homeowner",
        via: "assistant",
        requestedBy: user?.email || "",
        assigneeType: "",
        contractorId: "",
        contractorName: "",
        quoteStatus: "none",
        quoteAmount: "",
        scheduledFor: "",
        createdOn: todayLabel(),
      })
    }
    const next = messages.map((m, i) =>
      i === msgIndex
        ? {
            ...m,
            actions: m.actions.map((a, j) => (j === actionIndex ? { ...a, status: "done" } : a)),
          }
        : m
    )
    setMessages(next)
    await persist(next)
  }

  async function attachPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setDoc(null)
    setPhoto(await compressImage(file))
    e.target.value = ""
  }

  async function attachDoc(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_DOC_BYTES) {
      setError("That file is over 10MB — email it to the team instead.")
      e.target.value = ""
      return
    }
    const buf = await file.arrayBuffer()
    let binary = ""
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    setPhoto(null)
    setDoc({ file, base64: btoa(binary) })
    setError("")
    e.target.value = ""
  }

  const pastConversations = [...convApi.items].reverse()

  return (
    <div>
      <PageHeader
        title="Assistant"
        subtitle={`Knows ${profile.address || "your home"} inside out — ask anything, any hour. Conversations are shared with your HPS team.`}
      />

      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="bg-plane rounded-xl px-4 py-3 text-sm text-ink-2 max-w-[85%]">
            I'm the HPS assistant for {profile.address || "your home"}. I know its systems,
            plan, and history — ask me anything, tell me what's changed, or send a photo of
            something that doesn't look right. Prefer a person? The team is one call away.
          </div>

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "max-w-[85%]"}>
              <div
                className={
                  m.role === "user"
                    ? "bg-brand-700 text-white rounded-xl px-4 py-3 text-sm whitespace-pre-line"
                    : "bg-plane text-ink-2 rounded-xl px-4 py-3 text-sm whitespace-pre-line"
                }
              >
                {m.hadPhoto && <span className="block text-xs opacity-75 mb-1">📷 photo attached</span>}
                {m.hadDoc && <span className="block text-xs opacity-75 mb-1">📎 {m.hadDoc}</span>}
                {m.text}
              </div>
              {m.actions?.length > 0 && (
                <div className="mt-2 flex flex-col items-start gap-2">
                  {m.actions.map((a, j) => (
                    <ActionChip key={j} action={a} onConfirm={() => confirmAction(i, j)} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {sending && <p className="text-xs text-ink-3">Thinking…</p>}
          {error && (
            <p className="text-sm text-status-critical">
              {error} — you can also use the{" "}
              <Link to="/" className="underline">
                Request button
              </Link>{" "}
              on your home page.
            </p>
          )}

          <div className="flex items-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              aria-label="Attach photo"
              onClick={() => fileRef.current?.click()}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm ${photo ? "border-brand-400 bg-brand-100" : "border-line text-ink-3 hover:text-ink"}`}
            >
              📷{photo ? " ✓" : ""}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={attachPhoto} />
            <button
              type="button"
              aria-label="Attach document"
              onClick={() => docRef.current?.click()}
              className={`shrink-0 rounded-full border px-3 py-2 text-sm ${doc ? "border-brand-400 bg-brand-100" : "border-line text-ink-3 hover:text-ink"}`}
            >
              📎{doc ? " ✓" : ""}
            </button>
            <input ref={docRef} type="file" accept="application/pdf" className="hidden" onChange={attachDoc} />
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about the home, report something, or request service…"
              className="flex-1 border border-line rounded-xl px-3.5 py-2.5 bg-surface text-ink text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
            />
            <Button onClick={send} disabled={sending || !input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </Card>

      {documents.length > 0 && (
        <Card title={`Documents (${documents.length})`} className="mb-4">
          <ul className="divide-y divide-line">
            {[...documents].reverse().map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-2">{d.name}</span>
                <span className="shrink-0 text-xs text-ink-3">
                  {d.uploadedOn}
                  {d.url && !d.url.startsWith("mock://") && (
                    <>
                      {" · "}
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:text-brand-800 underline"
                      >
                        open
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pastConversations.length > 0 && (
        <Card title={`Past conversations (${pastConversations.length})`}>
          <ul className="divide-y divide-line">
            {pastConversations.map((c) => (
              <li key={c.id} className="py-2">
                <button
                  type="button"
                  className="text-sm text-left text-brand-600 hover:text-brand-800"
                  onClick={() => setOpenConv(openConv === c.id ? null : c.id)}
                >
                  {c.startedOn} — {c.summary}
                </button>
                {openConv === c.id && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {(c.messages || []).map((m, i) => (
                      <p key={i} className="text-xs text-ink-2">
                        <span className="font-semibold text-ink-3">
                          {m.role === "user" ? "Member" : "Assistant"}:
                        </span>{" "}
                        {m.hadPhoto ? "📷 " : ""}
                        {m.text}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
