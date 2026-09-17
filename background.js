// 后台：每日提醒（alarms + notifications）与工具栏图标角标。
import { computeEvent, today, ymdToStr, describeDate, dayNumber, subtractUnits, matchEvery, sameYmd } from "./src/dates.js";
import { loadEvents, loadSettings, saveSettings, tagColor, ruleDays } from "./src/store.js";
import { t, setLang, resolveLang } from "./src/i18n.js";

const ALARM_DAILY = "daycount-daily-reminder";
const ALARM_MIDNIGHT = "daycount-midnight-refresh";
const ICON = "icons/icon128.png";

// ---------- 调度 ----------
function nextTimeToday(hhmm) {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime();
}

async function scheduleDaily() {
  const s = await loadSettings();
  await chrome.alarms.create(ALARM_DAILY, { when: nextTimeToday(s.remindTime || "09:00"), periodInMinutes: 24 * 60 });
}

async function scheduleMidnight() {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 10, 0);
  await chrome.alarms.create(ALARM_MIDNIGHT, { when: t.getTime(), periodInMinutes: 24 * 60 });
}

// ---------- 角标 ----------
function pickTopEvent(events, settings) {
  const opts = { includeToday: settings.includeToday };
  const items = events.map((e) => ({ e, c: computeEvent(e, opts) })).filter((x) => !x.c.invalid);
  items.sort((a, b) => {
    if (a.e.pinned !== b.e.pinned) return a.e.pinned ? -1 : 1;
    if (a.c.sortKey !== b.c.sortKey) return a.c.sortKey - b.c.sortKey;
    return b.e.updatedAt - a.e.updatedAt;
  });
  return items[0] || null;
}

function badgeNumber(n) {
  if (n < 10000) return String(n);
  return Math.floor(n / 1000) + "k";
}

async function updateBadge() {
  try {
    const [events, settings] = await Promise.all([loadEvents(), loadSettings()]);
    setLang(resolveLang(settings.language));
    const top = settings.badge === "none" ? null : pickTopEvent(events, settings);
    if (!top) {
      await chrome.action.setBadgeText({ text: "" });
      await chrome.action.setTitle({ title: t("app.name") });
      return;
    }
    const { e, c } = top;
    const p = { title: e.title, n: c.days };
    let text;
    let title;
    if (c.isToday) { text = t("badge.today"); title = t("badge.title.today", p); }
    else if (c.mode === "countup") { text = badgeNumber(c.days); title = t("badge.title.since", p); }
    else { text = badgeNumber(c.days); title = t("badge.title.left", p); }
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: tagColor(e.tag) });
    if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
    await chrome.action.setTitle({ title: `${title} · ${describeDate(c.target)}` });
  } catch (err) {
    console.warn("updateBadge failed", err);
  }
}

// ---------- 提醒 ----------
function notify(id, title, message) {
  return new Promise((resolve) => {
    chrome.notifications.create(id, {
      type: "basic",
      iconUrl: ICON,
      title,
      message,
      priority: 2,
    }, () => {
      if (chrome.runtime.lastError) console.warn("notify failed", chrome.runtime.lastError.message);
      resolve();
    });
  });
}

function pruneNotified(notified, base) {
  const keep = {};
  const min = dayNumber(base) - 7;
  for (const key of Object.keys(notified)) {
    const date = key.split("|")[1];
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
    if (m && dayNumber({ y: +m[1], m: +m[2], d: +m[3] }) >= min) keep[key] = true;
  }
  return keep;
}

async function runReminderCheck({ force = false } = {}) {
  const [events, settings] = await Promise.all([loadEvents(), loadSettings()]);
  setLang(resolveLang(settings.language));
  const base = today();
  const todayStr = ymdToStr(base);
  const notified = pruneNotified(settings.notified || {}, base);
  let sent = 0;

  for (const e of events) {
    if (!e.remind || !e.remind.enabled) continue;
    const c = computeEvent(e, { includeToday: settings.includeToday });
    if (c.invalid) continue;

    if (c.mode === "countdown") {
      const hit = (e.remind.before || []).some((r) => sameYmd(subtractUnits(c.target, r.n, r.unit), base));
      const key = `${e.id}|${todayStr}|d${c.days}`;
      if (hit && (force || !notified[key])) {
        const title = t(c.days === 0 ? "notif.today" : "notif.left", { title: e.title, ann: annotation(c), n: c.days });
        await notify(key, title, eventBody(e, c));
        notified[key] = true;
        sent++;
      }
    } else {
      // 每满 N 天/周/月/年：多条规则同日命中时只发最“大”的那条（如 3 个月优先于 1 个月）
      const hits = (e.remind.every || [])
        .map((r) => ({ r, m: matchEvery(c.origin, base, r, c.days) }))
        .filter((x) => x.m)
        .sort((a, b) => ruleDays(b.r) - ruleDays(a.r));
      if (hits.length) {
        const { r, m } = hits[0];
        const key = `${e.id}|${todayStr}|e${c.days}`;
        if (force || !notified[key]) {
          const amount = m.count * r.n;
          const v = `${amount} ${t("unit." + r.unit, { n: amount })}`;
          await notify(key, t("notif.every.title", { title: e.title, v }), t("notif.every.body", { n: c.days, date: describeDate(c.origin) }));
          notified[key] = true;
          sent++;
        }
      }
    }
  }

  await saveSettings({ notified, lastCheckDate: todayStr });
  return sent;
}

function annotation(c) {
  if (c.repeat.unit === "none" || !c.nextIndex) return "";
  const cycle = c.repeat.unit === "year" && c.repeat.every === 1 ? t("cycle.anniversary", { n: c.nextIndex }) : t("cycle.nth", { n: c.nextIndex });
  return t("notif.ann", { v: cycle });
}

function eventBody(e, c) {
  return describeDate(c.target, { primaryLunar: e.calendar === "lunar" }) + (e.note ? `\n${e.note}` : "");
}

/** 浏览器在提醒时间点未运行时，启动后补发当天的提醒。 */
async function catchUpReminder() {
  const s = await loadSettings();
  const todayStr = ymdToStr(today());
  if (s.lastCheckDate === todayStr) return;
  const [h, m] = (s.remindTime || "09:00").split(":").map((n) => parseInt(n, 10));
  const now = new Date();
  const passed = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (passed) await runReminderCheck();
}

// ---------- 事件绑定 ----------
async function boot() {
  await chrome.alarms.clear("daycount-precise-reminder");
  await Promise.all([scheduleDaily(), scheduleMidnight()]);
  await updateBadge();
  await catchUpReminder();
}

chrome.runtime.onInstalled.addListener(() => { boot(); });
chrome.runtime.onStartup.addListener(() => { boot(); });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_DAILY) {
    await runReminderCheck();
    await updateBadge();
  } else if (alarm.name === ALARM_MIDNIGHT) {
    await updateBadge();
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.events) {
    await updateBadge();
  }
  if (changes.settings) {
    const oldV = changes.settings.oldValue || {};
    const newV = changes.settings.newValue || {};
    if (oldV.remindTime !== newV.remindTime) await scheduleDaily();
    if (oldV.badge !== newV.badge || oldV.includeToday !== newV.includeToday || oldV.language !== newV.language) await updateBadge();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "test-notification") {
    loadSettings()
      .then((s) => {
        setLang(resolveLang(s.language));
        return notify("daycount-test-" + Date.now(), t("notif.test.title"), t("notif.test.body", { date: describeDate(today()) }));
      })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === "run-reminder-check") {
    runReminderCheck({ force: !!msg.force }).then((sent) => sendResponse({ ok: true, sent }));
    return true;
  }
  return false;
});

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  try {
    await chrome.action.openPopup();
  } catch {
    chrome.runtime.openOptionsPage();
  }
});

// Service worker 被唤醒时也刷新一次角标（例如日期已变化）
updateBadge();
