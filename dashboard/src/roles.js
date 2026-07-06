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
  "sallyrryan@gmail.com": "relationship", // Sally — real login
  "sally@example.com": "relationship", // demo/test persona (unroutable, harmless)
  "tech@example.com": "technician",
}

export const businessRole = (email) => STAFF_ROLES[(email || "").toLowerCase()] || null

// Nav item keys per role (keys match Layout's item list).
const NAV = {
  founder: [
    "overview", "assistant", "walkthrough", "import", "health", "calendar",
    "priorities", "forecast", "history", "contractors",
  ],
  relationship: [
    "overview", "assistant", "walkthrough", "import", "health", "calendar",
    "priorities", "history", "contractors",
  ],
  technician: ["overview", "assistant", "health", "calendar", "priorities", "walkthrough", "history"],
  homeowner: [
    "overview", "assistant", "health", "calendar", "priorities", "forecast",
    "history", "contractors",
  ],
}

// --- "View as" preview (founders only) ---
// Founders can borrow any other role's lens to sanity-check what a
// homeowner, Sally, or a technician actually sees — without signing in
// as them. The choice persists (localStorage) across pages and property
// switches until changed. Presentation only: it never grants anything,
// it only hides, and it has no effect for non-founders.

const VIEW_AS_KEY = "viewAsRole"

export const ROLE_LABELS = {
  founder: "Founder — full view",
  relationship: "Relationship (intake)",
  technician: "Technician (visit)",
  homeowner: "Homeowner",
}

export function getViewAs() {
  try {
    const v = localStorage.getItem(VIEW_AS_KEY)
    return v && NAV[v] ? v : "founder"
  } catch {
    return "founder"
  }
}

export function setViewAs(role) {
  try {
    if (!role || role === "founder") localStorage.removeItem(VIEW_AS_KEY)
    else if (NAV[role]) localStorage.setItem(VIEW_AS_KEY, role)
  } catch {
    /* private mode etc. — preview just won't persist */
  }
}

export function viewFor(email) {
  const actualRole = businessRole(email) || "homeowner"
  const role = actualRole === "founder" ? getViewAs() : actualRole
  return {
    role,
    actualRole,
    preview: actualRole === "founder" && role !== "founder",
    navKeys: new Set(NAV[role]),
    business: role === "founder", // Business nav section + its pages
    staff: role !== "homeowner", // internal instruments (onboarding checklist)
    showBilling: role === "founder" || role === "homeowner",
  }
}
