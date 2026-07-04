// Who sees what. Four viewing roles, matching the actual team:
//   founder       — business owners (Paddy, Mike): everything.
//   relationship  — the client-facing seat (Sally): property plane plus the
//                   intake tools (walkthrough, import), no business plane,
//                   no financial forecast.
//   technician    — the visit seat: the systems, the manifest, the jobs.
//                   No money, no member management, no business plane.
//   homeowner     — the member default: their home's record, clean and
//                   uncluttered. Internal tools (walkthrough, import) and
//                   the business plane stay out of their way.
//
// Phase 1 is presentation, not security: business-plane pages are already
// rules-enforced (founders allowlist in firestore.rules); property-plane
// hiding is view tailoring for people who are legitimately members.
// Phase 2 (staff access without co-ownership) is the technician-share
// rules work in the backlog.

import { FOUNDER_EMAILS } from "./founders"

// Business staff by email. Add real teammates here as they join —
// unlisted members simply get the homeowner view, which is the safe
// default. The demo/test personas are harmless in production (nobody
// signs in with @example.com).
export const STAFF_ROLES = {
  ...Object.fromEntries(FOUNDER_EMAILS.map((e) => [e, "founder"])),
  "sally@example.com": "relationship",
  "tech@example.com": "technician",
}

export const businessRole = (email) => STAFF_ROLES[(email || "").toLowerCase()] || null

// Nav item keys per role (keys match Layout's item list).
const NAV = {
  founder: [
    "overview", "walkthrough", "import", "health", "calendar",
    "priorities", "forecast", "history", "contractors",
  ],
  relationship: [
    "overview", "walkthrough", "import", "health", "calendar",
    "priorities", "history", "contractors",
  ],
  technician: ["overview", "health", "calendar", "priorities", "walkthrough", "history"],
  homeowner: [
    "overview", "health", "calendar", "priorities", "forecast",
    "history", "contractors",
  ],
}

export function viewFor(email) {
  const role = businessRole(email) || "homeowner"
  return {
    role,
    navKeys: new Set(NAV[role]),
    business: role === "founder", // Business nav section + its pages
    showBilling: role === "founder" || role === "homeowner",
  }
}
