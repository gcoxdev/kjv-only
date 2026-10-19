import { expect, it } from "vitest";
import { dayOfYear } from "@/lib/calendar-date";
it("uses calendar days rather than elapsed hours across DST and leap years", () => {
  expect(dayOfYear(new Date(2026, 2, 9, 0, 15))).toBe(68);
  expect(dayOfYear(new Date(2026, 10, 2, 0, 15))).toBe(306);
  expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
  expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
});
