// One-shot production maintenance, founder-requested 7/27:
//   Set the parcel / tax-map ID on the real home's profile. The value is
//   Albemarle County APN 05900-00-00-020B1 (Tax Map 59, Parcel 20B1),
//   confirmed against the assessor record — lot 218,279 sqft = 5.011 ac
//   and built 1992 both match the profile we seeded from public records.
//
// Guarded: refuses unless the target's address starts with "895".
// Idempotent — re-running is harmless. (The previous one-shot — Brook
// Lane stub delete + address correction — ran 7/26 and is done.)

import { initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

const HOME_ID = "qMiuCATsw2P96T6tYaAH539V7Pd2" // 895 Old Ballard
const PARCEL_ID = "05900-00-00-020B1"

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
const had = home.get("parcelId") || "(none)"
await homeRef.update({ parcelId: PARCEL_ID })
console.log(`update: parcelId ${had === PARCEL_ID ? "already set" : `"${had}" → set`} on the 895 record`)

console.log("maintenance complete")
