import { describe, it, expect } from "vitest"
import { dataUrlToFile } from "../photoUtils"

describe("dataUrlToFile", () => {
  it("rebuilds an uploadable File from a data URL, keeping name and mime", () => {
    // "hi" base64-encoded.
    const file = dataUrlToFile("data:image/jpeg;base64,aGk=", "nameplate.jpg")
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe("nameplate.jpg")
    expect(file.type).toBe("image/jpeg")
    expect(file.size).toBe(2) // "hi"
  })
  it("falls back to a default name and jpeg mime", () => {
    const file = dataUrlToFile("data:;base64,aGk=")
    expect(file.name).toMatch(/^photo-\d+\.jpg$/)
    expect(file.type).toBe("image/jpeg")
  })
})
