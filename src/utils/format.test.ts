import { describe, it, expect } from "vitest";
import { formatMessageTime } from "./format";

describe("formatMessageTime utility", () => {
  it("formats valid Date objects using the specified or default time options", () => {
    const fixedDate = new Date("2026-01-01T14:30:00Z");
    const result = formatMessageTime(fixedDate, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    // Validates 2-digit hour/minute in UTC
    expect(result).toMatch(/02:30\s*PM|14:30/i);
  });

  it("formats valid ISO timestamp strings", () => {
    const result = formatMessageTime("2026-06-15T09:05:00Z", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    expect(result).toMatch(/09:05\s*AM|09:05/i);
  });

  it("returns empty string for null, undefined, and empty string inputs", () => {
    expect(formatMessageTime(null)).toBe("");
    expect(formatMessageTime(undefined)).toBe("");
    expect(formatMessageTime("")).toBe("");
  });

  it("returns empty string for whitespace-only strings", () => {
    expect(formatMessageTime("   ")).toBe("");
    expect(formatMessageTime("\t\n")).toBe("");
  });

  it("returns empty string for invalid date strings without crashing or exposing raw tokens", () => {
    expect(formatMessageTime("invalid-date-string")).toBe("");
    expect(formatMessageTime("not-a-timestamp")).toBe("");
  });

  it("returns empty string for invalid Date objects", () => {
    const invalidDate = new Date("invalid date");
    expect(formatMessageTime(invalidDate)).toBe("");
  });

  it("respects custom Intl.DateTimeFormatOptions like 24-hour hour12: false", () => {
    const fixedDate = new Date("2026-01-01T23:45:00Z");
    const result = formatMessageTime(fixedDate, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });

    expect(result).toBe("23:45");
  });
});
