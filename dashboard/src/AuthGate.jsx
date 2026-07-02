import { useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup } from "firebase/auth"
import { auth, googleProvider } from "./firebase"

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [error, setError] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plane text-ink-2">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-plane px-4">
        <div className="bg-white border border-line rounded-lg p-8 max-w-sm w-full text-center shadow-sm">
          <p className="text-xs uppercase tracking-wider text-ink-2">
            Charlottesville
          </p>
          <p className="text-lg font-semibold text-ink mb-6">
            Home &amp; Property Services
          </p>
          <button
            type="button"
            onClick={() =>
              signInWithPopup(auth, googleProvider).catch((e) =>
                setError(e.message)
              )
            }
            className="w-full bg-brand-700 text-white rounded-md py-2.5 font-medium hover:bg-brand-800 transition-colors"
          >
            Sign in with Google
          </button>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </div>
    )
  }

  // Any signed-in Google user may proceed to the app; access to actual
  // property data is enforced by property membership (Firestore rules +
  // the resolver in Layout), not by a single hardcoded email here.
  return children(user)
}
