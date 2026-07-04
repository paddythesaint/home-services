import { useEffect } from "react"
import { useItems } from "./useItems"

// Subscribes to one property's copy of a collection and reports the items
// up, tagged with which property they're from — the cross-property
// aggregation unit behind the Contractor Network table, contractor
// profiles, and the Work Orders board.
export function PropertyCollectionFeed({ propertyId, propertyLabel, collection, onItems }) {
  const { items } = useItems(propertyId, collection)
  useEffect(() => {
    onItems(propertyId, items.map((it) => ({ ...it, propertyId, propertyLabel })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, propertyLabel, collection, items])
  return null
}

export function PropertyJobFeed({ propertyId, propertyLabel, onJobs }) {
  return (
    <PropertyCollectionFeed
      propertyId={propertyId}
      propertyLabel={propertyLabel}
      collection="jobHistory"
      onItems={onJobs}
    />
  )
}
