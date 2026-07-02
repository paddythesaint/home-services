import { useEffect, useState } from "react"
import {
  subscribeItems,
  addItem,
  updateItem,
  removeItem,
  reorderItems,
} from "./firestoreApi"

export function useItems(uid, collectionName) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeItems(uid, collectionName, (list) => {
      setItems(list)
      setLoading(false)
    })
    return unsubscribe
  }, [uid, collectionName])

  return {
    items,
    loading,
    add: (data) => addItem(uid, collectionName, data),
    update: (id, data) => updateItem(uid, collectionName, id, data),
    remove: (id) => removeItem(uid, collectionName, id),
    moveUp: (index) => {
      if (index === 0) return
      reorderItems(uid, collectionName, items[index - 1], items[index])
    },
    moveDown: (index) => {
      if (index === items.length - 1) return
      reorderItems(uid, collectionName, items[index], items[index + 1])
    },
  }
}
