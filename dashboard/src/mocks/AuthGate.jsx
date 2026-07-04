// Mock AuthGate: skips Google sign-in and renders the app as a fixed user.
// Override the identity with VITE_MOCK_USER to preview non-founder views
// (e.g. VITE_MOCK_USER=sally@example.com npm run build:mock).

import { MOCK_FOUNDER } from "./fixtures"

const email = import.meta.env.VITE_MOCK_USER || MOCK_FOUNDER.email

const user =
  email === MOCK_FOUNDER.email
    ? MOCK_FOUNDER
    : { email, displayName: email.split("@")[0], uid: `mock-${email}` }

export default function AuthGate({ children }) {
  return (
    <>
      <div className="bg-amber-100 text-amber-900 text-xs text-center py-1">
        Mock mode — signed in as {user.email}, data is in-memory fixture data
      </div>
      {children(user)}
    </>
  )
}
