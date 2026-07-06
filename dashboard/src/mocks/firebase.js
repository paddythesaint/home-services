// Inert stand-in for firebase.js in mock/test mode — nothing initializes,
// no env vars needed. Modules that import { auth } etc. get harmless stubs;
// anything that would actually call Firebase goes through firestoreApi,
// which is separately mocked.

export const app = null
export const auth = {}
export const db = null
export const storage = null
export const googleProvider = {}
export const OWNER_EMAIL = "paddythesaint@gmail.com"
