// 日期工具与倒数/正数计算。日期一律用 {y, m, d}（m 为 1-12），天数差基于 UTC 日序号，不受夏令时影响。
import { solarToLunar, lunarToSolar, lunarYearInfo, formatLunar, LUNAR_MAX_YEAR } from "./lunar.js";
import { t } from "./i18n.js";

export function today() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

export function dayNumber({ y, m, d }) {
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromDayNumber(n) {
  const dt = new Date(n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function diffDays(a, b) {
  return dayNumber(a) - dayNumber(b);
}

export function addDays(ymd, n) {
  return fromDayNumber(dayNumber(ymd) + n);
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidYmd(v) {
  return (
    v && Number.isInteger(v.y) && Number.isInteger(v.m) && Number.isInteger(v.d) &&
    v.m >= 1 && v.m <= 12 && v.d >= 1 && v.d <= daysInMonth(v.y, v.m)
  );
}

const pad2 = (n) => String(n).padStart(2, "0");

export function ymdToStr({ y, m, d }) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function strToYmd(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const v = { y: +m[1], m: +m[2], d: +m[3] };
  return isValidYmd(v) ? v : null;
}

export function weekdayName(ymd) {
  return t("date.weekday")[new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay()];
}

export function sameYmd(a, b) {
  return a && b && a.y === b.y && a.m === b.m && a.d === b.d;
}

/** 阳历“每年”重复：某年份的对应日期（2 月 29 日在平年退到 2 月 28 日）。 */
function solarInYear(origin, year) {
  return { y: year, m: origin.m, d: Math.min(origin.d, daysInMonth(year, origin.m)) };
}

/** 阳历“每月”重复：某年某月的对应日期。 */
function solarInMonth(origin, y, m) {
  return { y, m, d: Math.min(origin.d, daysInMonth(y, m)) };
}

/** 事件的原始阳历日期（农历事件按其农历年月日换算）。 */
export function originSolar(event) {
  if (event.calendar === "lunar") {
    return lunarToSolar(event.lunar) || null;
  }
  return event.solar;
}

export const REPEAT_UNITS = ["none", "day", "week", "month", "year"];

/** 统一 repeat 结构：{ unit, every }。兼容旧版字符串 "yearly" / "monthly" / "none"。 */
export function normalizeRepeat(raw) {
  if (typeof raw === "string") {
    if (raw === "yearly") return { unit: "year", every: 1 };
    if (raw === "monthly") return { unit: "month", every: 1 };
    return { unit: "none", every: 1 };
  }
  const unit = raw && REPEAT_UNITS.includes(raw.unit) ? raw.unit : "none";
  let every = raw ? parseInt(raw.every, 10) : 1;
  if (!Number.isInteger(every) || every < 1) every = 1;
  if (every > 999) every = 999;
  return { unit, every: unit === "none" ? 1 : every };
}

/** 阳历事件按月循环：第 k 个周期对应的日期。 */
function solarMonthCycle(O, k, every) {
  const total = (O.y * 12 + (O.m - 1)) + k * every;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return solarInMonth(O, y, m);
}

/** 农历某年的对应日期；若原日期在闰月而该年没有该闰月，则退到同名平月。 */
function lunarInYear(L, year) {
  const yi = lunarYearInfo(year);
  if (!yi) return null;
  const exact = yi.months.find((mm) => mm.month === L.month && mm.isLeap === !!L.isLeap)
    || yi.months.find((mm) => mm.month === L.month && !mm.isLeap);
  if (!exact) return null;
  return addDays(exact.start, Math.min(L.day, exact.days) - 1);
}

/**
 * 下一次发生日期（>= base）。不重复的事件返回原始日期。
 * 返回 { date, index }，index 为第几个周期（0 表示原始日期本身）。
 */
export function nextOccurrence(event, base) {
  const { unit, every } = normalizeRepeat(event.repeat);
  const origin = originSolar(event);
  if (!origin) return null;
  if (unit === "none") return { date: origin, index: 0 };

  const baseN = dayNumber(base);
  const originN = dayNumber(origin);

  if (unit === "day" || unit === "week") {
    const step = every * (unit === "week" ? 7 : 1);
    const k = Math.max(0, Math.ceil((baseN - originN) / step));
    return { date: fromDayNumber(originN + k * step), index: k };
  }

  if (event.calendar === "lunar") {
    const L = event.lunar;
    const baseLunar = solarToLunar(base);
    if (!baseLunar) return { date: origin, index: 0 };
    if (unit === "year") {
      const kStart = Math.max(0, Math.floor((baseLunar.year - L.year) / every) - 1);
      for (let k = kStart; k < kStart + 6; k++) {
        const y = L.year + k * every;
        if (y > LUNAR_MAX_YEAR) break;
        const s = lunarInYear(L, y);
        if (s && dayNumber(s) >= baseN) return { date: s, index: k };
      }
      return null;
    }
    // 按农历月循环：从原始月份起逐月枚举，第 k 个月里 k % every === 0 的为候选
    let k = 0;
    let started = false;
    for (let y = L.year; y <= baseLunar.year + 2; y++) {
      const yi = lunarYearInfo(y);
      if (!yi) break;
      for (const mm of yi.months) {
        if (!started) {
          if (y === L.year && mm.month === L.month && mm.isLeap === !!L.isLeap) started = true;
          else if (y === L.year && mm.month === L.month && L.isLeap && !mm.isLeap) started = true;
          else continue;
        } else {
          k++;
        }
        if (k % every !== 0) continue;
        const s = addDays(mm.start, Math.min(L.day, mm.days) - 1);
        if (dayNumber(s) >= baseN) return { date: s, index: k / every };
      }
    }
    return null;
  }

  const O = event.solar;
  if (unit === "year") {
    const kStart = Math.max(0, Math.floor((base.y - O.y) / every) - 1);
    for (let k = kStart; k < kStart + 4; k++) {
      const s = solarInYear(O, O.y + k * every);
      if (dayNumber(s) >= baseN) return { date: s, index: k };
    }
  } else {
    const monthsBetween = (base.y - O.y) * 12 + (base.m - O.m);
    const kStart = Math.max(0, Math.floor(monthsBetween / every) - 1);
    for (let k = kStart; k < kStart + 4; k++) {
      const s = solarMonthCycle(O, k, every);
      if (dayNumber(s) >= baseN) return { date: s, index: k };
    }
  }
  return { date: O, index: 0 };
}

/**
 * 计算一个事件在 base（默认今天）的展示信息。类型由日期与循环自动决定：
 *  - 不循环且日期已过：mode = countup，主数字为已经过去的天数；
 *  - 其他情况：mode = countdown，主数字为距（下一次）日期的天数；
 *  - 循环事件另给出 since（距原始日期已过天数）与 nextIndex（第几个周期）。
 */
export function computeEvent(event, opts = {}) {
  const base = opts.base || today();
  const includeToday = !!opts.includeToday;
  const origin = originSolar(event);
  const repeat = normalizeRepeat(event.repeat);

  const result = {
    mode: "countdown",
    repeat,
    origin,
    target: null,
    targetLunar: null,
    days: 0,
    isToday: false,
    since: null,      // 距原始日期已过天数（原始日期在今天或之前时）
    nextIndex: 0,     // 循环事件：第几个周期
    sortKey: Infinity,
    invalid: !origin,
  };
  if (!origin) return result;

  const sinceOrigin = diffDays(base, origin);
  if (sinceOrigin >= 0) result.since = sinceOrigin + (includeToday ? 1 : 0);

  if (repeat.unit === "none" && sinceOrigin > 0) {
    result.mode = "countup";
    result.target = origin;
    result.days = result.since;
    result.sortKey = 1e9 + sinceOrigin;
  } else {
    const nx = nextOccurrence(event, base) || { date: origin, index: 0 };
    result.target = nx.date;
    result.nextIndex = nx.index;
    const dd = Math.max(0, diffDays(nx.date, base));
    result.days = dd;
    result.isToday = dd === 0;
    result.sortKey = dd;
  }
  result.targetLunar = solarToLunar(result.target);
  return result;
}

function addMonths(ymd, n) {
  const total = ymd.y * 12 + (ymd.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(ymd.d, daysInMonth(y, m)) };
}

/** 日历精确的年/月/日差（from <= to）：从 from 起数满整月，余数为天。 */
export function diffYMD(from, to) {
  let months = Math.max(0, (to.y - from.y) * 12 + (to.m - from.m));
  let anchor = addMonths(from, months);
  while (months > 0 && dayNumber(anchor) > dayNumber(to)) {
    months--;
    anchor = addMonths(from, months);
  }
  return { y: Math.floor(months / 12), m: months % 12, d: diffDays(to, anchor) };
}

export const DISPLAY_MODES = ["days", "weeks", "months", "years"];

// ---------- 提醒规则 ----------
export const REMIND_UNITS = ["day", "week", "month", "year"];

/** 规范化一条提醒规则 { n, unit }；无效返回 null。n = 0 只对“天”有意义（当天）。旧版时/分/秒折成当天。 */
export function normalizeRule(raw, { allowZero = false, units = REMIND_UNITS } = {}) {
  if (!raw || typeof raw !== "object") return null;
  let n = parseInt(raw.n, 10);
  let unit = raw.unit;
  if (unit === "second" || unit === "minute" || unit === "hour") {
    n = 0;
    unit = "day";
  }
  unit = units.includes(unit) ? unit : "day";
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1) || n > 9999) return null;
  if (n === 0) unit = "day";
  return { n, unit };
}

export function sameRule(a, b) {
  return a.n === b.n && a.unit === b.unit;
}

/** 目标日期往前推 n 个单位后的日期（提前提醒的触发日）。 */
export function subtractUnits(ymd, n, unit) {
  if (unit === "day") return addDays(ymd, -n);
  if (unit === "week") return addDays(ymd, -n * 7);
  if (unit === "month") return addMonths(ymd, -n);
  return addMonths(ymd, -n * 12);
}

/**
 * 判断 base 是否恰好是从 origin 起“每满 n 单位”的整数倍纪念日。
 * 命中返回 { count }（第几个周期），否则 null。days 为已过天数（可含“包含当天”的 +1）。
 */
export function matchEvery(origin, base, rule, days) {
  if (rule.unit === "day" || rule.unit === "week") {
    const step = rule.n * (rule.unit === "week" ? 7 : 1);
    return days > 0 && days % step === 0 ? { count: days / step } : null;
  }
  const months = (base.y - origin.y) * 12 + (base.m - origin.m);
  if (months <= 0) return null;
  const step = rule.unit === "year" ? rule.n * 12 : rule.n;
  if (months % step !== 0) return null;
  return sameYmd(addMonths(origin, months), base) ? { count: months / step } : null;
}

/**
 * 把主数字拆成展示片段 [{ n, unit }]，unit 为 year/month/week/day。
 * days 与 from/to 需一致；includeToday 只影响 days（片段计算基于日期差再补 1 天）。
 */
export function durationParts(mode, days, from, to) {
  if (mode === "weeks" && days >= 7) {
    const parts = [{ n: Math.floor(days / 7), unit: "week" }];
    if (days % 7) parts.push({ n: days % 7, unit: "day" });
    return parts;
  }
  if ((mode === "months" || mode === "years") && from && to) {
    const a = dayNumber(from) <= dayNumber(to) ? from : to;
    const b = a === from ? to : from;
    const ymd = diffYMD(a, b);
    const extra = days - diffDays(b, a); // includeToday 补的 1 天
    ymd.d += extra;
    const parts = [];
    if (mode === "years") {
      if (ymd.y) parts.push({ n: ymd.y, unit: "year" });
      if (ymd.m) parts.push({ n: ymd.m, unit: "month" });
    } else if (ymd.y || ymd.m) {
      parts.push({ n: ymd.y * 12 + ymd.m, unit: "month" });
    }
    if (ymd.d || !parts.length) parts.push({ n: ymd.d, unit: "day" });
    return parts;
  }
  return [{ n: days, unit: "day" }];
}

/** 事件的“日期描述行”，如 "2026-10-01 周四 · 八月十五"。 */
export function describeDate(ymd, { primaryLunar = false } = {}) {
  if (!ymd) return "";
  const solarText = `${ymdToStr(ymd)} ${weekdayName(ymd)}`;
  const lunar = solarToLunar(ymd);
  if (!lunar) return solarText;
  const lunarText = t("date.lunar.prefix") + formatLunar(lunar);
  return primaryLunar ? `${lunarText} · ${solarText}` : `${solarText} · ${lunarText}`;
}

export function formatDaysHuman(days) {
  const years = Math.floor(days / 365.25);
  if (years < 1) return "";
  const rest = Math.round(days - years * 365.25);
  return t("human.years", { y: years, d: rest });
}
