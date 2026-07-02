import { useEffect, useState } from "react"
import { subscribeProperty, saveProperty } from "./firestoreApi"

const DEFAULT_PROPERTY = {
  address: "895 Old Ballard Road",
  areaLabel: "Charlottesville, VA 22901",
  acreage: 0,
  yearBuilt: 0,
  profileSessionDate: "",
  conductedBy: "",
  clientName: "",
  tier: "Founding Member",
  monthlyRate: 0,
  nextInvoiceDate: "",
  referralCredits: 0,
}

export function useProperty(uid) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    return subscribeProperty(uid, (data) => {
      if (data === null) {
        saveProperty(uid, DEFAULT_PROPERTY)
      } else {
        setProfile(data)
      }
    })
  }, [uid])

  return {
    profile,
    save: (data) => saveProperty(uid, data),
  }
}
