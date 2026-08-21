import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isAccessTokenNearExpiry,
  isAuthError,
  isSessionExpiringSoon,
  refreshAccessToken,
  REFRESH_LEAD_MS,
  SESSION_WARN_MS,
  SessionExpiredError,
} from "./github-token"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("isAuthError", () => {
  it("recognises 401 in the various error shapes", () => {
    expect(isAuthError({ data: { statusCode: 401 } })).toBe(true) // isomorphic-git HttpError
    expect(isAuthError({ status: 401 })).toBe(true)
    expect(isAuthError(new Error("HTTP Error: 401 Unauthorized"))).toBe(true)
    expect(isAuthError(new Error("Bad credentials"))).toBe(true)
  })

  it("ignores non-auth errors", () => {
    expect(isAuthError(new Error("network timeout"))).toBe(false)
    expect(isAuthError({ data: { statusCode: 409 } })).toBe(false)
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
  })
})

describe("expiry helpers", () => {
  const now = 1_000_000_000_000

  it("treats a missing access expiry as not-near (dev PAT / non-expiring)", () => {
    expect(isAccessTokenNearExpiry(undefined, now)).toBe(false)
  })

  it("is near expiry only inside the lead window", () => {
    expect(isAccessTokenNearExpiry(now + 2 * REFRESH_LEAD_MS, now)).toBe(false)
    expect(isAccessTokenNearExpiry(now + REFRESH_LEAD_MS - 1, now)).toBe(true)
    expect(isAccessTokenNearExpiry(now - 1, now)).toBe(true) // already past
  })

  it("warns only inside the session warn window", () => {
    expect(isSessionExpiringSoon(undefined, now)).toBe(false)
    expect(isSessionExpiringSoon(now + 2 * SESSION_WARN_MS, now)).toBe(false)
    expect(isSessionExpiringSoon(now + SESSION_WARN_MS - 1, now)).toBe(true)
  })
})

describe("refreshAccessToken", () => {
  it("returns the refreshed session on success", async () => {
    const body = { token: "gho_new", accessTokenExpiresAt: 111, refreshTokenExpiresAt: 222 }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }),
    )
    await expect(refreshAccessToken()).resolves.toEqual(body)
  })

  it("throws SessionExpiredError on 401 (dead refresh token)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )
    await expect(refreshAccessToken()).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it("throws a plain error on a transient failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    )
    const err = await refreshAccessToken().catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(SessionExpiredError)
  })
})
