import { useEffect } from "react"
import { useItems } from "./useItems"

// Subscribes to one property's job history and reports jobs up, tagged with
// which property they're from — the cross-property aggregation unit used by
// the Contractor Network table and the contractor profile pages.
export function PropertyJobFeed({ propertyId, propertyLabel, onJobs }) {
  const { items } = useItems(propertyId, "jobHistory")
  useEffect(() => {
    onJobs(propertyId, items.map((j) => ({ ...j, propertyId, propertyLabel })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, propertyLabel, items])
  return null
}
