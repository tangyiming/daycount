// 本地数据层：所有数据仅保存在 chrome.storage.local，不做任何云端同步。
import { isValidYmd, strToYmd, ymdToStr, normalizeRepeat, normalizeRule, sameRule, DISPLAY_MODES } from "./dates.js";
import { LUNAR_MIN_YEAR, LUNAR_MAX_YEAR } from "./lunar.js";
import { t, LANGS } from "./i18n.js";

export const STORAGE_KEYS = { events: "events", settings: "settings" };
export const DATA_FORMAT = { app: "daycount", version: 2 };

export const BUILTIN_TAGS = [
  { name: "纪念日", color: "#FF5A5F" },
  { name: "生活", color: "#2FB36B" },
  { name: "工作", color: "#3B7DFF" },
  { name: "学习", color: "#8E5CFF" },
  { name: "节日", color: "#FF9F1C" },
  { name: "其他", color: "#7A869A" },
];
const EXTRA_PALETTE = ["#00A8A8", "#E0559B", "#6B8E23", "#C0392B", "#2C7BB6", "#B8860B"];

// 提醒规则快捷选项
export const REMIND_BEFORE_PRESETS = [
  { n: 0, unit: "day" },
  { n: 1, unit: "day" },
  { n: 3, unit: "day" },
  { n: 1, unit: "week" },
  { n: 1, unit: "month" },
];
export const REMIND_EVERY_PRESETS = [
  { n: 100, unit: "day" },
  { n: 1, unit: "month" },
  { n: 1, unit: "year" },
];
export const REMIND_BEFORE_UNITS = ["day", "week", "month"];
export const REMIND_EVERY_UNITS = ["day", "week", "month", "year"];

function uniqRules(list) {
  const out = [];
  for (const r of list) if (r && !out.some((x) => sameRule(x, r))) out.push(r);
  return out;
}

/** 规范化 remind：{ enabled, before:[{n,unit}], every:[{n,unit}] }，兼容旧版 days / hundreds。 */
export function normalizeRemind(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  let before = Array.isArray(r.before) ? r.before.map((x) => normalizeRule(x, { allowZero: true, units: REMIND_BEFORE_UNITS })) : null;
  if (!before && Array.isArray(r.days)) before = r.days.map((d) => normalizeRule({ n: d, unit: "day" }, { allowZero: true }));
  let every = Array.isArray(r.every) ? r.every.map((x) => normalizeRule(x, { units: REMIND_EVERY_UNITS })) : null;
  if (!every && r.hundreds) every = [{ n: 100, unit: "day" }];
  return {
    enabled: !!r.enabled,
    before: uniqRules(before || [{ n: 0, unit: "day" }]).sort((a, b) => ruleDays(a) - ruleDays(b)),
    every: uniqRules(every || []).sort((a, b) => ruleDays(a) - ruleDays(b)),
  };
}

const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 };
export function ruleDays(rule) {
  return rule.n * UNIT_DAYS[rule.unit];
}

export const DEFAULT_SETTINGS = {
  language: "auto",      // auto | zh | en
  remindTime: "09:00",   // 每日提醒时间 HH:MM
  includeToday: false,   // 正数纪念是否把起始日算作第 1 天
  badge: "top",          // top: 图标角标显示首个事件天数；none: 不显示
  lastCheckDate: "",     // 上次执行提醒检查的日期
  notified: {},          // 已发送提醒记录 { "eventId|date|offset": true }
};

export function tagColor(name) {
  const t = BUILTIN_TAGS.find((x) => x.name === name);
  if (t) return t.color;
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_PALETTE[h % EXTRA_PALETTE.length];
}

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (r) => resolve(r || {})));
}
function storageSet(obj) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.set(obj, () => (chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()))
  );
}

export async function loadEvents() {
  const r = await storageGet(STORAGE_KEYS.events);
  const list = Array.isArray(r[STORAGE_KEYS.events]) ? r[STORAGE_KEYS.events] : [];
  const events = list.map(normalizeEvent).filter(Boolean);
  const next = enforceSinglePin(events);
  if (next !== events) await saveEvents(next);
  return next;
}

export async function saveEvents(events) {
  await storageSet({ [STORAGE_KEYS.events]: enforceSinglePin(events) });
}

export async function loadSettings() {
  const r = await storageGet(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(r[STORAGE_KEYS.settings] || {}) };
}

export async function saveSettings(patch) {
  const cur = await loadSettings();
  const next = { ...cur, ...patch };
  await storageSet({ [STORAGE_KEYS.settings]: next });
  return next;
}

export async function upsertEvent(event) {
  const events = await loadEvents();
  const idx = events.findIndex((e) => e.id === event.id);
  const now = Date.now();
  const normalized = normalizeEvent({ ...event, updatedAt: now, createdAt: event.createdAt || now });
  if (!normalized) throw new Error(t("store.invalid.event"));
  if (normalized.pinned) {
    for (const e of events) e.pinned = e.id === normalized.id;
  }
  if (idx >= 0) events[idx] = normalized;
  else events.push(normalized);
  await saveEvents(events);
  return normalized;
}

export async function deleteEvent(id) {
  const events = await loadEvents();
  await saveEvents(events.filter((e) => e.id !== id));
}

/** 校验并补全一个事件对象；无效返回 null。 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim();
  if (!title) return null;

  const calendar = raw.calendar === "lunar" ? "lunar" : "solar";
  const e = {
    id: String(raw.id || newId()),
    title: title.slice(0, 60),
    calendar,
    solar: null,
    lunar: null,
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time || "") ? raw.time : "",
    repeat: normalizeRepeat(raw.repeat),
    display: DISPLAY_MODES.includes(raw.display) ? raw.display : "days",
    tag: String(raw.tag || "其他").trim().slice(0, 12) || "其他",
    remind: normalizeRemind(raw.remind),
    pinned: !!raw.pinned,
    note: String(raw.note || "").slice(0, 500),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };

  if (calendar === "lunar") {
    const L = raw.lunar || {};
    const lunar = { year: +L.year, month: +L.month, day: +L.day, isLeap: !!L.isLeap };
    if (
      !Number.isInteger(lunar.year) || lunar.year < LUNAR_MIN_YEAR || lunar.year > LUNAR_MAX_YEAR ||
      !Number.isInteger(lunar.month) || lunar.month < 1 || lunar.month > 12 ||
      !Number.isInteger(lunar.day) || lunar.day < 1 || lunar.day > 30
    ) return null;
    e.lunar = lunar;
  } else {
    let solar = raw.solar;
    if (typeof solar === "string") solar = strToYmd(solar);
    if (!solar && typeof raw.date === "string") solar = strToYmd(raw.date);
    if (solar) solar = { y: +solar.y, m: +solar.m, d: +solar.d };
    if (!isValidYmd(solar)) return null;
    e.solar = solar;
  }
  return e;
}

/** 同时只允许 1 个置顶：优先保留 keepId，否则保留最近更新的。 */
export function enforceSinglePin(events, keepId) {
  const pinned = events.filter((e) => e.pinned);
  if (pinned.length <= 1) return events;
  const keep = (keepId && pinned.find((e) => e.id === keepId))
    || pinned.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  return events.map((e) => (e.pinned && e.id !== keep.id ? { ...e, pinned: false } : e));
}

/** 导出为 JSON 文本。 */
export function buildExport(events, settings) {
  const { notified, lastCheckDate, ...userSettings } = settings || {};
  const payload = {
    ...DATA_FORMAT,
    exportedAt: new Date().toISOString(),
    settings: userSettings,
    events: events.map((e) => ({
      ...e,
      // 附带可读日期，便于人工查看/其他工具处理
      date: e.calendar === "solar" ? ymdToStr(e.solar) : undefined,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/** 解析导入文本，返回 { events, settings, errors }。 */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("store.import.notjson"));
  }
  const list = Array.isArray(data) ? data : Array.isArray(data && data.events) ? data.events : null;
  if (!list) throw new Error(t("store.import.noevents"));
  const events = [];
  const errors = [];
  list.forEach((raw, i) => {
    const e = normalizeEvent(raw);
    if (e) events.push(e);
    else errors.push(t("store.import.skipped", { i: i + 1 }));
  });
  const s = data && typeof data.settings === "object" && data.settings ? data.settings : {};
  const settings = {};
  if (typeof s.remindTime === "string" && /^\d{2}:\d{2}$/.test(s.remindTime)) settings.remindTime = s.remindTime;
  if (typeof s.includeToday === "boolean") settings.includeToday = s.includeToday;
  if (s.badge === "top" || s.badge === "none") settings.badge = s.badge;
  if (s.language === "auto" || LANGS.includes(s.language)) settings.language = s.language;
  return { events, settings, errors };
}

/** 合并导入：同 id 覆盖，其余追加。后导入的置顶优先。 */
export function mergeEvents(existing, incoming) {
  const map = new Map(existing.map((e) => [e.id, e]));
  let keepId = null;
  for (const e of incoming) {
    map.set(e.id, e);
    if (e.pinned) keepId = e.id;
  }
  return enforceSinglePin([...map.values()], keepId);
}
