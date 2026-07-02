// Claude API client for the intake assistant. Calls the Anthropic API
// directly from the browser using the owner's own API key (stored in their
// owner-only Firestore profile) — the supported pattern for a single-user
// static app until a backend exists.

const MODEL = "claude-sonnet-5"

export async function callClaude(apiKey, system, messages, tools) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export const assistantTools = [
  {
    name: "update_system",
    description:
      "Update fields on an existing Property Health Report system. Use the system's id from the property record. Set verified true (with today's date handled automatically) once the user has confirmed the system's details.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        fields: {
          type: "object",
          properties: {
            category: { type: "string" },
            detail: { type: "string" },
            brand: { type: "string" },
            installYear: { type: "string" },
            lastServiced: { type: "string" },
            location: { type: "string" },
            condition: { type: "string", enum: ["good", "attention", "urgent"] },
            note: { type: "string" },
            verified: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      required: ["id", "fields"],
    },
  },
  {
    name: "add_system",
    description: "Add a new system to the Property Health Report.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        detail: { type: "string" },
        condition: { type: "string", enum: ["good", "attention", "urgent"] },
        note: { type: "string" },
        brand: { type: "string" },
        installYear: { type: "string" },
        lastServiced: { type: "string" },
        location: { type: "string" },
      },
      required: ["category", "detail"],
    },
  },
  {
    name: "remove_system",
    description:
      "Remove a system from the Property Health Report (e.g. it doesn't exist on this property). Confirm with the user before removing.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "add_job",
    description: "Add an entry to the Job History (completed or scheduled work).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "e.g. 'March 2024'" },
        title: { type: "string" },
        category: { type: "string" },
        sub: { type: "string", description: "Contractor/provider, or '—' if unknown" },
        status: { type: "string", enum: ["completed", "scheduled"] },
        cost: { type: "string", description: "e.g. '$450', or '—' if unknown" },
        notes: { type: "string" },
      },
      required: ["date", "title", "status"],
    },
  },
  {
    name: "add_priority",
    description: "Add an item to the 90-Day Priority List.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        category: { type: "string" },
        reason: { type: "string" },
        estCost: { type: "string" },
        urgency: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["title", "urgency"],
    },
  },
  {
    name: "update_priority",
    description: "Update or resolve an existing priority item by id.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        fields: {
          type: "object",
          properties: {
            title: { type: "string" },
            category: { type: "string" },
            reason: { type: "string" },
            estCost: { type: "string" },
            urgency: { type: "string", enum: ["high", "medium", "low"] },
          },
          additionalProperties: false,
        },
      },
      required: ["id", "fields"],
    },
  },
  {
    name: "remove_priority",
    description: "Remove a priority item (completed or no longer relevant).",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "add_calendar_task",
    description: "Add a recurring seasonal task to the Annual Care Calendar.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", enum: MONTHS },
        task: { type: "string" },
      },
      required: ["month", "task"],
    },
  },
  {
    name: "log_activity",
    description:
      "Append a dated entry to a system's history timeline. Use for readings (a measured value), actions taken, observations, or service performed — e.g. a radon monitor reading in a specific room, or 'moved monitor to master bedroom'. This accumulates history; it does NOT overwrite the system's note. Include value+unit for anything measured so it can be trended later.",
    input_schema: {
      type: "object",
      properties: {
        systemId: { type: "string" },
        type: {
          type: "string",
          enum: ["reading", "action", "observation", "service"],
        },
        summary: { type: "string", description: "Short description of what happened" },
        value: { type: "string", description: "Measured value, if any (e.g. '1.8')" },
        unit: { type: "string", description: "Unit for the value (e.g. 'pCi/L')" },
      },
      required: ["systemId", "type", "summary"],
    },
  },
  {
    name: "set_recurring_check",
    description:
      "Set how often a system should be re-verified, and optionally mark it checked now. Use when the user wants ongoing monitoring — e.g. radon verified quarterly. Marking checked now stamps today and schedules the next due date.",
    input_schema: {
      type: "object",
      properties: {
        systemId: { type: "string" },
        frequencyMonths: {
          type: "number",
          description: "Months between checks (1, 3, 6, 12, 24, 36). 0 to remove.",
        },
        markCheckedNow: {
          type: "boolean",
          description: "If true, record that it was verified today and set the next due date.",
        },
      },
      required: ["systemId", "frequencyMonths"],
    },
  },
  {
    name: "resolve_priority",
    description:
      "Disposition a priority item without deleting it: mark it resolved (done), dismissed (not applicable), or scheduled. Keeps the audit trail. Include a note on what was done or why.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["resolved", "dismissed", "scheduled"] },
        note: { type: "string" },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "save_photo",
    description:
      "File the photo(s) the user attached to their latest message under a specific system's photo gallery on the Health Report. Use after identifying which system the photo shows (add_system first if it's a new system).",
    input_schema: {
      type: "object",
      properties: { systemId: { type: "string" } },
      required: ["systemId"],
    },
  },
  {
    name: "update_property",
    description: "Update the property's basic profile fields.",
    input_schema: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          properties: {
            address: { type: "string" },
            areaLabel: { type: "string" },
            acreage: { type: "number" },
            yearBuilt: { type: "number" },
            bedrooms: { type: "number" },
            bathrooms: { type: "number" },
            clientName: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      required: ["fields"],
    },
  },
]

export function buildSystemPrompt({ profile, systems, priorities, jobs, calendar }) {
  const snapshot = {
    property: {
      address: profile.address,
      area: profile.areaLabel,
      acreage: profile.acreage,
      yearBuilt: profile.yearBuilt,
      bedrooms: profile.bedrooms,
      bathrooms: profile.bathrooms,
    },
    systems: systems.map((s) => ({
      id: s.id,
      category: s.category,
      detail: s.detail,
      condition: s.condition,
      verified: !!s.verified,
      brand: s.brand || null,
      installYear: s.installYear || null,
      lastServiced: s.lastServiced || null,
      location: s.location || null,
      recurringCheckMonths: Number(s.verifyFrequencyMonths) || 0,
      nextCheckDue: s.nextDue || null,
      note: s.note,
    })),
    priorities: priorities
      .filter((p) => !p.status || p.status === "open" || p.status === "scheduled")
      .map((p) => ({
        id: p.id,
        title: p.title,
        urgency: p.urgency,
        status: p.status || "open",
        reason: p.reason,
      })),
    recentJobs: jobs.slice(-8).map((j) => ({
      date: j.date,
      title: j.title,
      status: j.status,
    })),
    careCalendarTaskCount: calendar.length,
  }

  return `You are the property intake assistant for ${profile.address}, ${profile.areaLabel} — a conversational way for the homeowner (or a visiting technician) to confirm, correct, and enrich the property record.

Today's date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.

How to behave:
- Be warm, concise, and practical. One or two focused questions at a time — never a wall of questions.
- The flow is non-linear: follow the user's lead. If they jump from the roof to the water heater, go with them. If they have nothing in mind, pick the highest-value gap yourself (unverified systems, missing brands/install years/locations, or the urgent radon item).
- When the user states a fact, record it IMMEDIATELY with the right tool — don't ask permission first. Then confirm in a few words what you saved.
- When the user confirms a system's details are right (or you've just filled them in together while they're looking at it), set verified: true on it.
- Facts you record should be terse and factual (they render on dashboard cards). Keep conversation in the chat, not in the notes.
- If the user mentions past or upcoming work, capture it as a job. If they mention something that needs doing, offer to add it as a priority.
- If something they say contradicts the record, trust the user and update it.
- History vs. state: use log_activity for things that HAPPENED at a point in time (a reading, a service visit, an observation) — these accumulate on a timeline and must NOT overwrite the note. Use update_system only for the current-state fields (condition, brand, note). Example: if the user says "radon monitor reads 1.8 in the master, we've moved it around and it's low everywhere", log_activity a reading (value 1.8, unit pCi/L), consider set_recurring_check for ongoing monitoring, and update_system to set condition good — don't cram the reading into the note.
- When the user describes ongoing monitoring or a maintenance cadence ("check quarterly", "annual service"), use set_recurring_check.
- When a priority is done or moot, use resolve_priority (resolved/dismissed) rather than leaving it or asking to delete it.
- Never invent facts. If unsure what the user meant, ask.
- The user may attach photos — nameplates, equipment, rooms, problem areas. Read them carefully: extract brand, model, serial, and manufacture/install year from nameplates (decode date-of-manufacture from serial formats when you're confident), note visible condition issues, record everything via tools, and file the image with save_photo under the system it shows.

Current property record (ids are what you pass to tools):
${JSON.stringify(snapshot, null, 1)}`
}
