import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { __reset } from "../mocks/firestoreApi"

// Fresh fixture data for every test — mutations never leak across tests.
afterEach(() => {
  __reset()
})
