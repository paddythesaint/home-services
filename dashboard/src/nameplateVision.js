// Nameplate reading via the backend AI proxy — replaces Tesseract as the
// primary reader (it stays as offline fallback in PhotoSection). The
// backend verifies membership and holds the API key; this module only
// ships an image and shapes the reply into suggestion fields.

import { callClaude } from "./backendApi"

const PROMPT = `This is a photo of home-equipment (an appliance/system nameplate, data plate, or the unit itself). Extract what is readable. Respond with ONLY a JSON object, no markdown fences, no other text:
{"brand": "<manufacturer, or null>", "model": "<model number, or null>", "serial": "<serial number, or null>", "installYear": "<4-digit year of manufacture/installation if determinable from the plate or serial-number format you are confident about, else null>", "condition_note": "<one short sentence on any visible condition issue, or null>"}`

// Pure shaping, unit-testable: model text → suggestion fields the
// PhotoSection UI understands ({brand, installYear, serial, note}).
export function parseVisionReply(text) {
  const cleaned = (text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim()
  const raw = JSON.parse(cleaned)
  const out = {}
  const brand = [raw.brand, raw.model].filter((v) => v && v !== "null").join(" ").trim()
  if (brand) out.brand = brand
  if (raw.installYear && String(raw.installYear).match(/^\d{4}$/)) {
    out.installYear = String(raw.installYear)
  }
  if (raw.serial && raw.serial !== "null") out.serial = String(raw.serial)
  if (raw.condition_note && raw.condition_note !== "null") out.note = raw.condition_note
  return out
}

export async function readNameplate(propertyId, dataUrl) {
  const data = await callClaude(propertyId, undefined, [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: dataUrl.split(",")[1],
          },
        },
        { type: "text", text: PROMPT },
      ],
    },
  ])
  const text = data.content?.find((b) => b.type === "text")?.text || ""
  return parseVisionReply(text)
}
