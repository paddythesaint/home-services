import { useEffect, useRef, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useItems } from "../useItems"
import { callClaude } from "../backendApi"
import { compressImage, dataUrlToFile } from "../photoUtils"
import { uploadDocument, MAX_DOC_BYTES } from "../storageApi"
import { todayLabel } from "../dates"
import {
  buildAssistantContext,
  assistantSystemPrompt,
  parseAssistantReply,
  transcriptMessage,
} from "../assistant"
import { applyAssistantAction, ACTION_DESTINATION } from "../assistantActions"
import { Card, Button } from "../components"

// The 24/7 concierge: knows this home's record (and nothing else), answers
// from it, files service requests, and learns — every fact saved here came
// through a confirm chip the member tapped. Transcripts are stored on the
// property and visible to the whole household and the HPS team.

const CHIP_DONE = {
  save_fact: "Saved to the record",
  service_request: "Request filed — see Happening now",
  log_job: "Logged — job history + care calendar updated",
  log_system: "Added to your Property Health Report",
}
const CHIP_BUTTON = {
  save_fact: "Save",
  service_request: "Send request",
  log_job: "Log job",
  log_system: "Add system",
}

function chipPrompt(action) {
  if (action.type === "save_fact") return `Record: "${action.fact}"`
  if (action.type === "log_job") return `Log job: "${action.title}"${action.task ? " — checks off its care task" : ""}`
  if (action.type === "log_system") return `Add to systems: "${action.title}"`
  return `File request: "${action.title}"`
}

function ActionChip({ action, onConfirm }) {
  if (action.status === "done") {
    const to = ACTION_DESTINATION[action.type]
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-100 rounded-full px-3 py-1.5">
        ✓ {CHIP_DONE[action.type]}
        {to && (
          <Link to={to} className="underline hover:text-brand-900">
            View →
          </Link>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 bg-plane border border-line rounded-xl px-3 py-2">
      <span className="text-xs text-ink-2">{chipPrompt(action)}</span>
      <Button variant="subtle" className="!py-1 !px-3 !text-xs shrink-0" onClick={onConfirm}>
        {CHIP_BUTTON[action.type]}
      </Button>
    </span>
  )
}

export default function Assistant() {
  const { uid, profile, user } = useOutletContext()
  const { items: systems } = useItems(uid, "healthReport")
  const { items: priorities } = useItems(uid, "priorityList")
  const calendarApi = useItems(uid, "careCalendar")
  const calendar = calendarApi.items
  const jobsApi = useItems(uid, "jobHistory")
  const jobs = jobsApi.items
  const { items: workOrders } = useItems(uid, "workOrders")
  const factsApi = useItems(uid, "facts")
  const convApi = useItems(uid, "conversations")
  const { items: documents } = useItems(uid, "documents")
  const { items: visitNotes } = useItems(uid, "visitNotes")

  const [messages, setMessages] = useState([]) // {role, text, hadPhoto?, actions?}
  const [input, setInput] = useState("")
  const [photo, setPhoto] = useState(null) // dataUrl pending attach
  const [photoName, setPhotoName] = useState("") // original filename, for filing
  const [doc, setDoc] = useState(null) // {file, base64} pending attach
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [openConv, setOpenConv] = useState(null)
  const convIdRef = useRef(null)
  const fileRef = useRef(null)
  const docRef = useRef(null)
  const threadEndRef = useRef(null)
  const composerRef = useRef(null)

  // Keep the newest message in view, like every native chat.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" })
  }, [messages, sending])

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
    if (composerRef.current) composerRef.current.style.height = "auto"

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
    const pendingPhoto = photo
    const pendingPhotoName = photoName
    setPhoto(null)
    setPhotoName("")
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
    if (pendingPhoto) {
      // Photos are filed too, so a nameplate or unit shot lands under the
      // home's documents instead of vanishing after the reply.
      try {
        await uploadDocument(uid, dataUrlToFile(pendingPhoto, pendingPhotoName), user?.email)
      } catch {
        setError(
          "The photo was read but couldn't be filed to storage — if this persists, the Storage rules may need publishing (see System status)."
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
        visitNotes,
        documents,
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
    // One shared write path with the Assistant Log's awaiting-confirmation
    // queue (assistantActions.js) — confirm here or confirm there, same
    // record lands.
    await applyAssistantAction(uid, action, user?.email)
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
    setPhotoName(file.name || `photo-${Date.now()}.jpg`)
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
      {/* Compact header — on a phone the thread is the page, so the chrome
          shrinks to one line and the chat takes the rest of the viewport. */}
      <div className="mb-3 md:mb-4">
        <h1 className="font-display text-xl md:text-3xl font-semibold text-ink">Assistant</h1>
        <p className="hidden md:block text-sm text-ink-2 mt-1">
          Knows {profile.address || "your home"} inside out — ask anything, any hour.
          Conversations are shared with your HPS team.
        </p>
      </div>

      {/* The chat shell: a fixed-height column — thread scrolls, composer
          stays pinned — full-bleed on mobile like a native chat app. */}
      <div className="flex flex-col bg-surface border-y md:border border-line md:rounded-2xl md:shadow-(--shadow-card) -mx-4 md:mx-0 mb-4 h-[calc(100dvh-13.5rem)] md:h-[calc(100dvh-16rem)] min-h-[20rem]">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-3">
          <div className="bg-plane rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-ink-2 max-w-[85%] self-start">
            I'm the HPS assistant for {profile.address || "your home"}. I know its systems,
            plan, and history — ask me anything, tell me what's changed, or send a photo of
            something that doesn't look right. Prefer a person? The team is one call away.
          </div>

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[85%]"}
            >
              <div
                className={
                  m.role === "user"
                    ? "bg-brand-700 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-line"
                    : "bg-plane text-ink-2 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm whitespace-pre-line"
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

          {sending && (
            <div className="self-start bg-plane rounded-2xl rounded-bl-md px-4 py-2.5">
              <span className="text-sm text-ink-3 animate-pulse">Thinking…</span>
            </div>
          )}
          {error && (
            <p className="text-sm text-status-critical">
              {error} — you can also use the{" "}
              <Link to="/" className="underline">
                Request button
              </Link>{" "}
              on your home page.
            </p>
          )}
          <div ref={threadEndRef} aria-hidden="true" />
        </div>

        <div className="shrink-0 border-t border-line px-3 md:px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          {(photo || doc) && (
            <div className="flex gap-2 mb-2">
              {photo && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2 bg-brand-100 border border-brand-400/40 rounded-full px-3 py-1">
                  📷 ✓ photo ready
                  <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="text-ink-3 hover:text-ink">
                    ×
                  </button>
                </span>
              )}
              {doc && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2 bg-brand-100 border border-brand-400/40 rounded-full px-3 py-1 min-w-0">
                  <span className="truncate max-w-40">📎 ✓ {doc.file.name}</span>
                  <button type="button" aria-label="Remove document" onClick={() => setDoc(null)} className="text-ink-3 hover:text-ink shrink-0">
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              aria-label="Attach photo"
              onClick={() => fileRef.current?.click()}
              className="shrink-0 w-9 h-9 mb-0.5 flex items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-plane text-base"
            >
              📷
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={attachPhoto} />
            <button
              type="button"
              aria-label="Attach document"
              onClick={() => docRef.current?.click()}
              className="shrink-0 w-9 h-9 mb-0.5 flex items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-plane text-base"
            >
              📎
            </button>
            <input ref={docRef} type="file" accept="application/pdf" className="hidden" onChange={attachDoc} />
            <textarea
              ref={composerRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // Grow with the text, like every native chat composer.
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about the home…"
              className="flex-1 resize-none border border-line rounded-3xl px-4 py-2 bg-surface text-ink text-[16px] md:text-sm leading-6 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
            />
            <button
              type="button"
              aria-label="Send"
              onClick={send}
              disabled={sending || !input.trim()}
              className={`shrink-0 w-9 h-9 mb-0.5 flex items-center justify-center rounded-full text-white transition-colors ${
                sending || !input.trim()
                  ? "bg-ink-3/40"
                  : "bg-brand-700 hover:bg-brand-800"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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
