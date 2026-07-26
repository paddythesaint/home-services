// One-shot production maintenance, founder-requested 7/26:
//   1. Delete the empty "1505 Brook Lane" stub property (recursively) —
//      it kept catching the app's property selector and produced today's
//      zero-asset census confusion. Verified empty by the record
//      diagnostic (0 records; 1 stray conversation).
//   2. Correct the real home's address: "895 Old Ballard Road" — the
//      record previously said "…Farm Ln", which is a different address.
//
// Both operations are guarded: the delete refuses unless the target's
// address starts with "1505", and the update refuses unless the target's
// address starts with "895". Idempotent — re-running is harmless.

import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

const DELETE_ID = "IdpJ4b2XqF4CSoKgYOGm" // 1505 Brook Lane stub
const HOME_ID = "qMiuCATsw2P96T6tYaAH539V7Pd2" // 895 Old Ballard
const CORRECT_ADDRESS = "895 Old Ballard Road"

// 1 · Delete the stub, with an address guard so a mistyped id can never
// take out a real home.
const stubRef = db.doc(`properties/${DELETE_ID}`)
const stub = await stubRef.get()
if (!stub.exists) {
  console.log(`delete: properties/${DELETE_ID} already gone — nothing to do`)
} else if (!(stub.get("address") || "").startsWith("1505")) {
  throw new Error(
    `delete REFUSED: properties/${DELETE_ID} address does not start with "1505" — wrong target?`
  )
} else {
  await db.recursiveDelete(stubRef)
  console.log(`delete: properties/${DELETE_ID} (1505…) removed recursively`)
}

// 2 · Correct the home's address.
const homeRef = db.doc(`properties/${HOME_ID}`)
const home = await homeRef.get()
if (!home.exists) {
  throw new Error(`update REFUSED: properties/${HOME_ID} not found`)
}
if (!(home.get("address") || "").startsWith("895")) {
  throw new Error(
    `update REFUSED: properties/${HOME_ID} address does not start with "895" — wrong target?`
  )
}
const before = home.get("address")
await homeRef.update({ address: CORRECT_ADDRESS })
console.log(`update: address "${before.slice(0, 6)}…" → "${CORRECT_ADDRESS.slice(0, 6)}…" (full value set)`)

console.log("maintenance complete")
