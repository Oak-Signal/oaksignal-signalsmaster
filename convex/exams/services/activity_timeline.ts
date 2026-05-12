import { Doc } from "../../_generated/dataModel";
import { roundToTwoDecimals } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type AdminTimelineRange = "7d" | "30d" | "90d";
export type AdminTimelineView = "daily" | "weekly" | "monthly";

export interface AdminExamActivityPoint {
  periodKey: string;
  label: string;
  rangeLabel: string;
  totalExams: number;
  passedExams: number;
  failedExams: number;
  passRatePercent: number;
  isPeak: boolean;
}

export interface AdminExamActivityTimeline {
  range: AdminTimelineRange;
  view: AdminTimelineView;
  timeZone: string;
  points: AdminExamActivityPoint[];
  peakTotalExams: number;
  generatedAt: number;
}

interface BuildTimelineInput {
  results: Array<Pick<Doc<"examResults">, "completedAt" | "passed">>;
  range: AdminTimelineRange;
  view: AdminTimelineView;
  timeZone: string;
  now?: number;
}

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

interface BucketCounter {
  periodKey: string;
  label: string;
  rangeLabel: string;
  totalExams: number;
  passedExams: number;
  failedExams: number;
}

const dateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateKeyFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dateKeyFormatterCache.set(timeZone, formatter);
  return formatter;
}

function toLocalDateKey(timestampMs: number, timeZone: string): string {
  return getDateKeyFormatter(timeZone).format(new Date(timestampMs));
}

function parseDateKey(dateKey: string): LocalDate {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return {
    year,
    month,
    day,
  };
}

function toDateKey(date: LocalDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function localDateToUtcDate(localDate: LocalDate): Date {
  return new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day));
}

function utcDateToLocalDate(date: Date): LocalDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addDays(dateKey: string, days: number): string {
  const parsed = parseDateKey(dateKey);
  const date = localDateToUtcDate(parsed);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(utcDateToLocalDate(date));
}

function getWeekStartDateKey(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  const date = localDateToUtcDate(parsed);
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return toDateKey(utcDateToLocalDate(date));
}

function getMonthStartDateKey(monthKey: string): string {
  return `${monthKey}-01`;
}

function getMonthEndDateKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const endOfMonthUtc = new Date(Date.UTC(year, month, 0));
  return toDateKey(utcDateToLocalDate(endOfMonthUtc));
}

function formatDateLabel(dateKey: string): string {
  const { month, day } = parseDateKey(dateKey);
  return `${MONTH_LABELS[month - 1]} ${day}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function getRangeDays(range: AdminTimelineRange): number {
  if (range === "7d") {
    return 7;
  }

  if (range === "30d") {
    return 30;
  }

  return 90;
}

function getPeriodKeyFromDateKey(dateKey: string, view: AdminTimelineView): string {
  if (view === "daily") {
    return dateKey;
  }

  if (view === "weekly") {
    return getWeekStartDateKey(dateKey);
  }

  return dateKey.slice(0, 7);
}

function getPeriodLabels(periodKey: string, view: AdminTimelineView): {
  label: string;
  rangeLabel: string;
} {
  if (view === "daily") {
    const label = formatDateLabel(periodKey);
    return {
      label,
      rangeLabel: label,
    };
  }

  if (view === "weekly") {
    const endDate = addDays(periodKey, 6);
    return {
      label: formatDateLabel(periodKey),
      rangeLabel: `${formatDateLabel(periodKey)} - ${formatDateLabel(endDate)}`,
    };
  }

  const startDate = getMonthStartDateKey(periodKey);
  const endDate = getMonthEndDateKey(periodKey);
  return {
    label: formatMonthLabel(periodKey),
    rangeLabel: `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`,
  };
}

function enumeratePeriodKeys(input: {
  range: AdminTimelineRange;
  view: AdminTimelineView;
  timeZone: string;
  now: number;
}): { startDateKey: string; endDateKey: string; periodKeys: string[] } {
  const rangeDays = getRangeDays(input.range);
  const endDateKey = toLocalDateKey(input.now, input.timeZone);
  const startDateKey = toLocalDateKey(input.now - (rangeDays - 1) * DAY_MS, input.timeZone);

  if (input.view === "daily") {
    const keys: string[] = [];
    let cursor = startDateKey;
    while (cursor <= endDateKey) {
      keys.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return { startDateKey, endDateKey, periodKeys: keys };
  }

  if (input.view === "weekly") {
    const keys: string[] = [];
    let cursor = getWeekStartDateKey(startDateKey);
    const endWeekKey = getWeekStartDateKey(endDateKey);
    while (cursor <= endWeekKey) {
      keys.push(cursor);
      cursor = addDays(cursor, 7);
    }
    return { startDateKey, endDateKey, periodKeys: keys };
  }

  const keys: string[] = [];
  const startMonth = startDateKey.slice(0, 7);
  const endMonth = endDateKey.slice(0, 7);
  let cursorMonth = startMonth;

  while (cursorMonth <= endMonth) {
    keys.push(cursorMonth);
    const [year, month] = cursorMonth.split("-").map((part) => Number(part));
    const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    cursorMonth = `${String(nextMonth.year).padStart(4, "0")}-${String(nextMonth.month).padStart(2, "0")}`;
  }

  return { startDateKey, endDateKey, periodKeys: keys };
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function normalizeAdminTimelineTimeZone(timeZone?: string): string {
  if (!timeZone) {
    return "UTC";
  }

  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

export function buildAdminExamActivityTimeline(input: BuildTimelineInput): AdminExamActivityTimeline {
  const now = input.now ?? Date.now();
  const { startDateKey, endDateKey, periodKeys } = enumeratePeriodKeys({
    range: input.range,
    view: input.view,
    timeZone: input.timeZone,
    now,
  });

  const buckets = new Map<string, BucketCounter>();
  for (const periodKey of periodKeys) {
    const labels = getPeriodLabels(periodKey, input.view);
    buckets.set(periodKey, {
      periodKey,
      label: labels.label,
      rangeLabel: labels.rangeLabel,
      totalExams: 0,
      passedExams: 0,
      failedExams: 0,
    });
  }

  for (const result of input.results) {
    const resultDateKey = toLocalDateKey(result.completedAt, input.timeZone);
    if (resultDateKey < startDateKey || resultDateKey > endDateKey) {
      continue;
    }

    const periodKey = getPeriodKeyFromDateKey(resultDateKey, input.view);
    const bucket = buckets.get(periodKey);
    if (!bucket) {
      continue;
    }

    bucket.totalExams += 1;
    if (result.passed) {
      bucket.passedExams += 1;
    } else {
      bucket.failedExams += 1;
    }
  }

  let peakTotalExams = 0;
  for (const bucket of buckets.values()) {
    if (bucket.totalExams > peakTotalExams) {
      peakTotalExams = bucket.totalExams;
    }
  }

  const points: AdminExamActivityPoint[] = periodKeys.map((periodKey) => {
    const bucket = buckets.get(periodKey)!;
    const passRatePercent =
      bucket.totalExams > 0
        ? roundToTwoDecimals((bucket.passedExams / bucket.totalExams) * 100)
        : 0;

    return {
      periodKey: bucket.periodKey,
      label: bucket.label,
      rangeLabel: bucket.rangeLabel,
      totalExams: bucket.totalExams,
      passedExams: bucket.passedExams,
      failedExams: bucket.failedExams,
      passRatePercent,
      isPeak: peakTotalExams > 0 && bucket.totalExams === peakTotalExams,
    };
  });

  return {
    range: input.range,
    view: input.view,
    timeZone: input.timeZone,
    points,
    peakTotalExams,
    generatedAt: now,
  };
}

export function getAdminTimelineRangeDays(range: AdminTimelineRange): number {
  return getRangeDays(range);
}
