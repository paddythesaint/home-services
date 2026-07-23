// Photo handling for nameplate capture. Photos are compressed client-side and
// stored as data URLs in their own Firestore docs (max ~1MB each), which keeps
// the whole feature on the free tier — Firebase's file storage product
// requires a paid plan for new projects.

export function compressImage(file, maxDim = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
      let dataUrl = canvas.toDataURL("image/jpeg", quality)
      // Firestore doc limit is 1MB — recompress harder if needed.
      if (dataUrl.length > 700_000) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.45)
      }
      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = url
  })
}

// Rebuild an uploadable File from a data URL, so a compressed photo can be
// filed to storage (which wants a File/Blob, not a base64 string).
export function dataUrlToFile(dataUrl, name) {
  const [head, b64] = String(dataUrl || "").split(",")
  const mime = head?.match(/data:(.*?);/)?.[1] || "image/jpeg"
  const bin = atob(b64 || "")
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name || `photo-${Date.now()}.jpg`, { type: mime })
}

export async function runOcr(dataUrl) {
  // Dynamic import keeps ~2MB of OCR code out of the main bundle.
  const Tesseract = await import("tesseract.js")
  const result = await Tesseract.recognize(dataUrl, "eng")
  return result.data.text || ""
}

const KNOWN_BRANDS = [
  "Trane", "Carrier", "Lennox", "Rheem", "Ruud", "Goodman", "York", "Bryant",
  "Amana", "American Standard", "Daikin", "Mitsubishi", "Payne", "Heil",
  "Bosch", "Navien", "Rinnai", "A.O. Smith", "AO Smith", "Bradford White",
  "State", "Generac", "Kohler", "Briggs", "Honeywell", "Rain Bird", "Hunter",
  "Whirlpool", "GE", "Square D", "Siemens", "Eaton", "Cutler-Hammer",
]

// Best-effort field extraction from noisy nameplate OCR text.
export function parseNameplate(text) {
  const suggestions = {}
  const upper = text.toUpperCase()

  for (const brand of KNOWN_BRANDS) {
    if (upper.includes(brand.toUpperCase())) {
      suggestions.brand = brand
      break
    }
  }

  const model = text.match(/(?:MODEL|MDL|MOD|M\/N)[\s#:.]*([A-Z0-9][A-Z0-9-]{3,})/i)
  if (model) {
    suggestions.brand = suggestions.brand
      ? `${suggestions.brand} ${model[1]}`
      : model[1]
  }

  const serial = text.match(/(?:SERIAL|SER|S\/N)[\s#:.]*([A-Z0-9][A-Z0-9-]{3,})/i)
  if (serial) suggestions.serial = serial[1]

  const years = [...text.matchAll(/\b(19[89]\d|20[0-2]\d)\b/g)].map((m) => m[1])
  if (years.length > 0) suggestions.installYear = years[0]

  return suggestions
}
