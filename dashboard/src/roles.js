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
  // Pilot cohort (diy): sophisticated owner-operators who self-build their
  // record — homeowner view plus the self-serve instruments. Add real pilot
  // emails here when the founder green-lights each one.
  "diy@example.com": "diy", // demo/test persona
}

export const businessRole = (email) => STAFF_ROLES[(email || "").toLowerCase()] || null

// Nav item keys per role (keys match Layout's item list). The nav is
// intent-shaped, not table-shaped: two hubs (record, plan) hold the
// detail pages as tabs, and the intake tools live under Tools for the
// seats that use them.
// Screen diet (7/27): Import Records and the Assistant Log left the nav —
// imports are reached contextually from Home, and the log's queue moved
// onto the Assistant page (routes stay alive for direct links).
const NAV = {
  founder: ["overview", "assistant", "record", "plan", "walkthrough", "systemMap"],
  relationship: ["overview", "assistant", "record", "plan", "walkthrough", "systemMap"],
  technician: ["overview", "assistant", "record", "plan", "walkthrough"],
  // diy pilots self-build: the homeowner surface plus the walkthrough and
  // bundle import (import stays off the nav per the screen diet — it's
  // reachable from Home's contextual link, same as founders).
  diy: ["overview", "assistant", "record", "plan", "walkthrough", "import"],
  homeowner: ["overview", "assistant", "record", "plan"],
}

// Tabs inside the two hubs, per role — the old page-level trims live on
// here (technicians see no vendors, staff see no money).
const RECORD_TABS = {
  // Founders keep only the Contractor Network — the Record-hub Contractors
  // tab was the same people behind a second door (screen diet, 7/27).
  founder: ["health", "history", "coverage"],
  relationship: ["health", "history", "coverage", "contractors"],
  technician: ["health", "history", "coverage"],
  diy: ["health", "history", "coverage", "contractors"],
  homeowner: ["health", "history", "coverage", "contractors"],
}
const PLAN_TABS = {
  founder: ["calendar", "priorities", "report"],
  relationship: ["calendar", "priorities", "report"],
  technician: ["calendar", "priorities"],
  diy: ["calendar", "priorities", "report"],
  homeowner: ["calendar", "priorities", "report"],
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
  diy: "DIY pilot (self-serve)",
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
    recordTabs: new Set(RECORD_TABS[role]),
    planTabs: new Set(PLAN_TABS[role]),
    business: role === "founder", // Business nav section + its pages
    staff: role !== "homeowner", // internal instruments (onboarding checklist)
    showBilling: role === "founder" || role === "homeowner",
  }
}
