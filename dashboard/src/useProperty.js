import { useEffect, useState } from "react"
import { subscribeProperty, saveProperty, resolvePropertyId } from "./firestoreApi"

// Resolve which property the signed-in user belongs to.
// status: "resolving" | "none" (not invited to any property) | "ready"
export function usePropertyId(user) {
  const [state, setState] = useState({ status: "resolving", propertyId: null })

  useEffect(() => {
    let active = true
    setState({ status: "resolving", propertyId: null })
    resolvePropertyId(user)
      .then((propertyId) => {
        if (!active) return
        setState(
          propertyId
            ? { status: "ready", propertyId }
            : { status: "none", propertyId: null }
        )
      })
      .catch(() => active && setState({ status: "none", propertyId: null }))
    return () => {
      active = false
    }
  }, [user.uid, user.email])

  return state
}

export function useProperty(propertyId) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!propertyId) return
    return subscribeProperty(propertyId, (data) => {
      setProfile(data || {})
    })
  }, [propertyId])

  return {
    profile,
    save: (data) => saveProperty(propertyId, data),
  }
}
