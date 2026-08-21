import { addDays } from "date-fns"
import { describe, expect, test } from "vitest"
import {
  formatDate,
  formatDateDistance,
  getDayRangeUtc,
  getNextBirthday,
  isValidDateString,
  isValidUnixTimestamp,
  isValidWeekString,
  toDateString,
} from "./date"

describe("isValidDateString", () => {
  test("returns true for valid date strings", () => {
    expect(isValidDateString("2021-07-11")).toBe(true)
    expect(isValidDateString("1998-07-11")).toBe(true)
    expect(isValidDateString("0000-01-01")).toBe(true)
  })

  test("returns false for invalid date strings", () => {
    expect(isValidDateString("")).toBe(false)
    expect(isValidDateString("2021-07")).toBe(false)
    expect(isValidDateString("2021-07-32")).toBe(false)
    expect(isValidDateString("2021-13-11")).toBe(false)
    expect(isValidDateString("2021-07-11T12:00:00")).toBe(false)
    expect(isValidDateString("hello")).toBe(false)
  })
})

describe("isValidWeekString", () => {
  test("returns true for valid week strings", () => {
    expect(isValidWeekString("2021-W01")).toBe(true)
    expect(isValidWeekString("2021-W53")).toBe(true)
  })

  test("returns false for invalid week strings", () => {
    expect(isValidWeekString("")).toBe(false)
    expect(isValidWeekString("2021-W00")).toBe(false)
    expect(isValidWeekString("2021-W54")).toBe(false)
    expect(isValidWeekString("2021-07-11")).toBe(false)
    expect(isValidWeekString("hello")).toBe(false)
  })
})

describe("formatDate", () => {
  test("formats a date string", () => {
    expect(formatDate("1998-07-11")).toBe("Sat, Jul 11, 1998")
  })

  test("excludes the day of week if option is set", () => {
    expect(formatDate("1998-07-11", { excludeDayOfWeek: true })).toBe("Jul 11, 1998")
  })

  test("throws an error if the date string is invalid", () => {
    expect(() => formatDate("")).toThrow()
    expect(() => formatDate("hello")).toThrow()
  })
})

describe("formatDateDistance", () => {
  test("formats a date string relative to today", () => {
    const today = new Date()
    expect(formatDateDistance(toDateString(today))).toBe("Today")

    const tomorrow = addDays(today, 1)
    expect(formatDateDistance(toDateString(tomorrow))).toBe("Tomorrow")

    const yesterday = addDays(today, -1)
    expect(formatDateDistance(toDateString(yesterday))).toBe("Yesterday")
  })

  test("throws an error if the date string is invalid", () => {
    expect(() => formatDateDistance("")).toThrow()
    expect(() => formatDateDistance("hello")).toThrow()
  })
})

describe("toDateString", () => {
  test("converts a date to a string in the format YYYY-MM-DD", () => {
    expect(toDateString(new Date(2021, 6, 11))).toBe("2021-07-11")
    expect(toDateString(new Date(1998, 6, 11))).toBe("1998-07-11")
    expect(toDateString(new Date(0, 0, 1))).toBe("1900-01-01")
  })
})

describe("getNextBirthday", () => {
  test("returns the next birthday for a given date", () => {
    const today = new Date()
    expect(getNextBirthday(new Date(1998, 6, 11))).greaterThan(today)
  })
})

describe("isValidUnixTimestamp", () => {
  test("returns true for valid unix timestamps", () => {
    expect(isValidUnixTimestamp("0")).toBe(true)
    expect(isValidUnixTimestamp("1626000000000")).toBe(true)
    expect(isValidUnixTimestamp("1626000000000000")).toBe(true)
  })

  test("returns false for invalid unix timestamps", () => {
    expect(isValidUnixTimestamp("")).toBe(false)
    expect(isValidUnixTimestamp("-1")).toBe(false)
    expect(isValidUnixTimestamp("hello")).toBe(false)
    expect(isValidUnixTimestamp("1626000000000.5")).toBe(false)
  })
})

describe("getDayRangeUtc", () => {
  // Deterministic: an explicit timezone means these hold on any host.
  test("buckets a day in London (BST, UTC+1 in August)", () => {
    expect(getDayRangeUtc("2026-08-15", "Europe/London")).toEqual({
      since: "2026-08-14T23:00:00.000Z",
      until: "2026-08-15T23:00:00.000Z",
    })
  })

  test("buckets a day in San Francisco (PDT, UTC-7 in August)", () => {
    expect(getDayRangeUtc("2026-08-15", "America/Los_Angeles")).toEqual({
      since: "2026-08-15T07:00:00.000Z",
      until: "2026-08-16T07:00:00.000Z",
    })
  })

  test("buckets a day in Tokyo (JST, UTC+9, no DST)", () => {
    expect(getDayRangeUtc("2026-08-15", "Asia/Tokyo")).toEqual({
      since: "2026-08-14T15:00:00.000Z",
      until: "2026-08-15T15:00:00.000Z",
    })
  })

  test("London and SF bucket the same commit into different days near midnight", () => {
    // A commit at 05:00 UTC on Aug 15.
    const commit = new Date("2026-08-15T05:00:00Z").getTime()
    const london = getDayRangeUtc("2026-08-15", "Europe/London")
    const sf = getDayRangeUtc("2026-08-15", "America/Los_Angeles")
    const inRange = (r: { since: string; until: string }) =>
      commit >= new Date(r.since).getTime() && commit < new Date(r.until).getTime()
    // Falls on Aug 15 in London...
    expect(inRange(london)).toBe(true)
    // ...but not in SF (there it belongs to Aug 14).
    expect(inRange(sf)).toBe(false)
    expect(
      commit >= new Date(getDayRangeUtc("2026-08-14", "America/Los_Angeles").since).getTime(),
    ).toBe(true)
  })

  test("handles a spring-forward day as 23 hours (America/New_York)", () => {
    const { since, until } = getDayRangeUtc("2026-03-08", "America/New_York")
    expect(since).toBe("2026-03-08T05:00:00.000Z") // EST, UTC-5
    expect(until).toBe("2026-03-09T04:00:00.000Z") // EDT, UTC-4
    const hours = (new Date(until).getTime() - new Date(since).getTime()) / 3_600_000
    expect(hours).toBe(23)
  })

  test("handles a fall-back day as 25 hours (America/New_York)", () => {
    const { since, until } = getDayRangeUtc("2026-11-01", "America/New_York")
    expect(since).toBe("2026-11-01T04:00:00.000Z") // EDT, UTC-4
    expect(until).toBe("2026-11-02T05:00:00.000Z") // EST, UTC-5
    const hours = (new Date(until).getTime() - new Date(since).getTime()) / 3_600_000
    expect(hours).toBe(25)
  })

  test("defaults to the device timezone and returns ISO UTC instants", () => {
    const { since, until } = getDayRangeUtc("2026-01-01")
    expect(since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(until).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(new Date(until).getTime()).toBeGreaterThan(new Date(since).getTime())
  })
})
