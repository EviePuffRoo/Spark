// A generic in-world calendar, not tied to any specific setting: 12 months
// of 30 days each (a 360-day year) with a 7-day week, so every world gets a
// readable date out of the box without the DM having to configure a custom
// calendar. World.currentDay is a plain day count starting at 1 — this file
// is purely presentational math over that count, with no state of its own.
export const CALENDAR_MONTHS: string[] = [
  "Frostmarch", "Thawmoot", "Greentide", "Sunreach", "Highsun", "Amberfall",
  "Harvestide", "Duskwane", "Emberfall", "Frostfall", "Longnight", "Snowbind",
];

export const CALENDAR_WEEKDAYS: string[] = [
  "Moonday", "Tideday", "Windday", "Hearthday", "Marketday", "Starday", "Restday",
];

export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = CALENDAR_MONTHS.length;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;

export interface CalendarDate {
  year: number;
  month: string;
  dayOfMonth: number;
  weekday: string;
  label: string;
}

export function describeCalendarDay(day: number): CalendarDate {
  const zeroBased = Math.max(0, Math.trunc(day) - 1);
  const year = Math.floor(zeroBased / DAYS_PER_YEAR) + 1;
  const dayOfYear = zeroBased % DAYS_PER_YEAR;
  const monthIndex = Math.floor(dayOfYear / DAYS_PER_MONTH);
  const dayOfMonth = (dayOfYear % DAYS_PER_MONTH) + 1;
  const month = CALENDAR_MONTHS[monthIndex];
  const weekday = CALENDAR_WEEKDAYS[zeroBased % CALENDAR_WEEKDAYS.length];
  return { year, month, dayOfMonth, weekday, label: `${weekday}, ${month} ${dayOfMonth}, Year ${year}` };
}
