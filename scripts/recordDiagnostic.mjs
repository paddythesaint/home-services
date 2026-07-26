// Privacy-safe production diagnostic, run from the record-diagnostic
// workflow with the deploy service account. Prints per-property record
// COUNTS only — never contents — because this repo's Actions logs are
// public. Enough to answer "is the data there, and on which property"
// when the app shows something impossible (like a zero-asset census).

import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

const COLLECTIONS = [
  "healthReport",
  "facts",
  "jobHistory",
  "workOrders",
  "careCalendar",
  "warranties",
  "documents",
  "conversations",
  "activity",
  "photos",
  "briefs",
]

// Addresses are semi-public but still masked: enough to tell homes apart.
const mask = (s = "") => (s.length <= 6 ? s : `${s.slice(0, 6)}…(${s.length} chars)`)

const props = await db.collection("properties").get()
console.log(`properties: ${props.size}`)
for (const doc of props.docs) {
  const d = doc.data()
  console.log(`\n— property ${doc.id}`)
  console.log(`  address: ${mask(d.address)}`)
  console.log(`  members: ${(d.memberEmails || []).length}`)
  console.log(`  emailTag: ${d.emailTag ? "set" : "unset"}`)
  for (const c of COLLECTIONS) {
    const snap = await db.collection(`properties/${doc.id}/${c}`).count().get()
    console.log(`  ${c}: ${snap.data().count}`)
  }
}
console.log("\ndiagnostic complete")
