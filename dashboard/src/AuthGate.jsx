import { useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import { auth, googleProvider, OWNER_EMAIL } from "./firebase"

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = signed out
  const [error, setError] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 text-brand-600">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="bg-white border border-brand-200 rounded-lg p-8 max-w-sm w-full text-center shadow-sm">
          <p className="text-xs uppercase tracking-wider text-brand-600">
            Charlottesville
          </p>
          <p className="text-lg font-semibold text-brand-900 mb-6">
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

  if (OWNER_EMAIL && user.email !== OWNER_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="bg-white border border-brand-200 rounded-lg p-8 max-w-sm w-full text-center shadow-sm">
          <p className="font-semibold text-brand-900 mb-2">Not authorized</p>
          <p className="text-sm text-brand-600 mb-6">
            {user.email} doesn't have access to this property dashboard.
          </p>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return children(user)
}
