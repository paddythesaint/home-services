import { useEffect, useRef, useState } from "react"
import {
  subscribePhotos,
  addPhoto,
  updatePhoto,
  removePhoto,
} from "./firestoreApi"
import { compressImage, runOcr, parseNameplate } from "./photoUtils"
import { Button, Modal } from "./components"

// Photo capture + nameplate OCR for one system. `onSuggest` receives parsed
// fields ({brand, installYear, serial}) when the user applies a suggestion.
export default function PhotoSection({ uid, systemId, onSuggest, startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  const [photos, setPhotos] = useState(null)
  const [busy, setBusy] = useState(null) // null | "saving" | "reading"
  const [suggestions, setSuggestions] = useState(null)
  const [viewing, setViewing] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!open) return
    return subscribePhotos(uid, systemId, setPhotos)
  }, [open, uid, systemId])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      setBusy("saving")
      const dataUrl = await compressImage(file)
      const ref = await addPhoto(uid, {
        systemId,
        dataUrl,
        takenOn: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        order: Date.now(),
      })
      setBusy("reading")
      const text = await runOcr(dataUrl)
      await updatePhoto(uid, ref.id, { ocrText: text })
      const parsed = parseNameplate(text)
      setSuggestions(Object.keys(parsed).length > 0 ? parsed : "none")
    } catch (err) {
      console.error(err)
      setSuggestions("error")
    } finally {
      setBusy(null)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-600 hover:text-brand-800"
      >
        Photos &rsaquo;
      </button>
    )
  }

  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="subtle" onClick={() => fileInput.current.click()} disabled={!!busy}>
          {busy === "saving"
            ? "Saving photo…"
            : busy === "reading"
              ? "Reading nameplate…"
              : "+ Add photo"}
        </Button>
        <span className="text-xs text-ink-3">
          Snap the nameplate — we'll read brand, model, and year off it
        </span>
      </div>

      {photos && photos.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.dataUrl}
                alt="System photo"
                className="w-20 h-20 object-cover rounded-md border border-line cursor-pointer"
                onClick={() => setViewing(photo)}
              />
              <button
                type="button"
                aria-label="Delete photo"
                onClick={() => removePhoto(uid, photo.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-line text-ink-3 hover:text-red-600 text-xs leading-none hidden group-hover:block"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {suggestions && suggestions !== "none" && suggestions !== "error" && (
        <div className="mt-3 bg-brand-50 border border-line rounded-md p-3">
          <p className="text-xs font-medium text-ink-2 mb-2">
            Read from the photo — apply what looks right:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.brand && (
              <Button
                variant="subtle"
                onClick={() => onSuggest({ brand: suggestions.brand })}
              >
                Brand/model: {suggestions.brand}
              </Button>
            )}
            {suggestions.installYear && (
              <Button
                variant="subtle"
                onClick={() => onSuggest({ installYear: suggestions.installYear })}
              >
                Year: {suggestions.installYear}
              </Button>
            )}
            {suggestions.serial && (
              <Button
                variant="subtle"
                onClick={() =>
                  onSuggest({ note: `Serial: ${suggestions.serial}` })
                }
              >
                Serial: {suggestions.serial}
              </Button>
            )}
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-ink-2"
              onClick={() => setSuggestions(null)}
            >
              dismiss
            </button>
          </div>
        </div>
      )}
      {suggestions === "none" && (
        <p className="text-xs text-ink-3 mt-2">
          Photo saved. Couldn't read any fields off it — a straight-on, well-lit
          shot of the nameplate works best.
        </p>
      )}
      {suggestions === "error" && (
        <p className="text-xs text-red-600 mt-2">
          Something went wrong processing that photo — try again.
        </p>
      )}

      {viewing && (
        <Modal title={`Photo — ${viewing.takenOn}`} onClose={() => setViewing(null)}>
          <img src={viewing.dataUrl} alt="System photo" className="w-full rounded-md" />
          {viewing.ocrText && (
            <details className="mt-3 text-xs text-ink-2">
              <summary className="cursor-pointer font-medium">Text read from photo</summary>
              <pre className="whitespace-pre-wrap mt-1">{viewing.ocrText}</pre>
            </details>
          )}
        </Modal>
      )}
    </div>
  )
}
