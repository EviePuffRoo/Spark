import { describe, it, expect } from "vitest";
import { describeCalendarDay, CALENDAR_MONTHS, CALENDAR_WEEKDAYS, DAYS_PER_YEAR } from "./calendar.js";

describe("describeCalendarDay", () => {
  it("starts Year 1, month 1, day 1 on day 1", () => {
    const d = describeCalendarDay(1);
    expect(d.year).toBe(1);
    expect(d.month).toBe(CALENDAR_MONTHS[0]);
    expect(d.dayOfMonth).toBe(1);
    expect(d.weekday).toBe(CALENDAR_WEEKDAYS[0]);
  });

  it("rolls into the next month after 30 days", () => {
    const d = describeCalendarDay(31);
    expect(d.year).toBe(1);
    expect(d.month).toBe(CALENDAR_MONTHS[1]);
    expect(d.dayOfMonth).toBe(1);
  });

  it("rolls into the next year after a full 360-day year", () => {
    const d = describeCalendarDay(DAYS_PER_YEAR + 1);
    expect(d.year).toBe(2);
    expect(d.month).toBe(CALENDAR_MONTHS[0]);
    expect(d.dayOfMonth).toBe(1);
  });

  it("cycles weekdays every 7 days", () => {
    expect(describeCalendarDay(1).weekday).toBe(describeCalendarDay(8).weekday);
    expect(describeCalendarDay(2).weekday).not.toBe(describeCalendarDay(1).weekday);
  });

  it("treats a non-positive day as day 1", () => {
    expect(describeCalendarDay(0)).toEqual(describeCalendarDay(1));
    expect(describeCalendarDay(-5)).toEqual(describeCalendarDay(1));
  });

  it("builds a readable label", () => {
    expect(describeCalendarDay(1).label).toBe(`${CALENDAR_WEEKDAYS[0]}, ${CALENDAR_MONTHS[0]} 1, Year 1`);
  });
});
