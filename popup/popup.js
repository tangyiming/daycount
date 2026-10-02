import { computeEvent, describeDate, today, ymdToStr, formatDaysHuman, weekdayName, durationParts, normalizeRepeat, normalizeRule, sameRule, daysInMonth, sameYmd } from "../src/dates.js";
import { solarToLunar, lunarToSolar, lunarYearInfo, lunarMonthName, lunarDayName, formatLunar, LUNAR_MIN_YEAR, LUNAR_MAX_YEAR } from "../src/lunar.js";
import {
  loadEvents, loadSettings, saveSettings, upsertEvent, deleteEvent, BUILTIN_TAGS, tagColor, newId, ruleDays,
  REMIND_BEFORE_PRESETS, REMIND_EVERY_PRESETS, REMIND_BEFORE_UNITS, REMIND_EVERY_UNITS, STORE_REVIEW_URL,
} from "../src/store.js";
import { t, tagLabel, initI18n, setLang, getLang, applyDom } from "../src/i18n.js";

const $ = (sel) => document.querySelector(sel);

const state = {
  events: [],
  settings: null,
  filter: "__all__",
  draft: null,
  editingId: null,
  repeatCustomUi: false,
  remindCustomOpen: false,
  calCursor: null,
  calView: "day",
};

// ---------- 工具 ----------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer = null;
function openDonate() {
  chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html#donate") });
}

function openStoreReview() {
  chrome.tabs.create({ url: STORE_REVIEW_URL });
}

async function hideReviewPrompt() {
  state.settings = await saveSettings({ reviewPromptHidden: true });
  $("#review-prompt").classList.add("hidden");
}

function toast(msg) {
  const tt = $("#toast");
  tt.textContent = msg;
  tt.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => tt.classList.remove("show"), 1800);
}

function lighten(hex, amount = 0.25) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== id));
  $("#" + id).scrollTop = 0;
}

// ---------- 文案 ----------
function unitName(unit, n) {
  return t("unit." + unit, { n });
}

function cycleLabel(c) {
  if (c.repeat.unit === "none" || !c.nextIndex) return "";
  if (c.repeat.unit === "year" && c.repeat.every === 1) return t("cycle.anniversary", { n: c.nextIndex });
  return t("cycle.nth", { n: c.nextIndex });
}

/**
 * 主数字的展示：{ label, parts:[{n, unit}], unit, isToday, past }。
 * 单片段时 unit 为“天”类文案（还有/已经）；多片段时每段自带单位。
 */
function daysText(e, c) {
  if (c.isToday) return { label: t("days.today.label"), parts: [], text: t("days.today"), isToday: true };
  const parts = durationParts(e.display || "days", c.days, c.mode === "countup" ? c.origin : today(), c.mode === "countup" ? today() : c.target);
  if (c.mode === "countup") {
    return { label: t("days.since.label"), parts, unit: t("days.since.unit", { n: c.days }), tail: t("days.since.tail"), past: true };
  }
  return { label: t("days.left.label"), parts, unit: t("days.left.unit", { n: c.days }), tail: t("days.left.tail") };
}

/** 把 parts 渲染为 [数字, 小单位, 数字, 小单位...]；单片段沿用“天”单位文案。 */
function renderParts(tx, { numClass = "", unitTag = "small" } = {}) {
  if (tx.isToday) return [el("span", { class: numClass, text: tx.text })];
  const multi = tx.parts.length > 1;
  if (!multi) {
    const p = tx.parts[0];
    return [el("span", { class: numClass, text: String(p.n) }), el(unitTag, { text: tx.unit })];
  }
  const out = [];
  tx.parts.forEach((p) => {
    out.push(el("span", { class: numClass, text: String(p.n) }));
    out.push(el(unitTag, { text: unitName(p.unit, p.n) }));
  });
  if (tx.tail) out.push(el(unitTag, { text: tx.tail }));
  return out;
}

function subParts(e, c) {
  const parts = [describeDate(c.target, { primaryLunar: e.calendar === "lunar" })];
  const cl = cycleLabel(c);
  if (cl) parts.push(cl);
  if (c.repeat.unit !== "none" && c.since !== null && c.since > 0 && c.days > 0) parts.push(t("cycle.since", { n: c.since }));
  return parts;
}

// ---------- 首页 ----------
function sortedEvents() {
  const opts = { includeToday: state.settings.includeToday };
  return state.events
    .map((e) => ({ e, c: computeEvent(e, opts) }))
    .sort((a, b) => {
      if (a.e.pinned !== b.e.pinned) return a.e.pinned ? -1 : 1;
      if (a.c.sortKey !== b.c.sortKey) return a.c.sortKey - b.c.sortKey;
      return b.e.updatedAt - a.e.updatedAt;
    });
}

function renderHero(items) {
  const hero = $("#hero");
  hero.innerHTML = "";
  if (!items.length) return;
  const { e, c } = items[0];
  const color = tagColor(e.tag);
  const tx = daysText(e, c);
  const parts = subParts(e, c);
  const human = c.mode === "countup" && (e.display || "days") === "days" ? formatDaysHuman(c.days) : "";
  if (human) parts.push(human);
  const multi = tx.parts.length > 1;

  const main = el("div", { class: "hero-main" + (multi ? " multi" : "") }, [
    tx.label ? el("span", { class: "hero-label", text: tx.label }) : null,
  ]);
  if (tx.isToday) main.append(el("span", { class: "hero-days", text: tx.text }));
  else if (!multi) {
    main.append(el("span", { class: "hero-days", text: String(tx.parts[0].n) }));
    if (tx.unit) main.append(el("span", { class: "hero-unit", text: tx.unit }));
  } else {
    tx.parts.forEach((p) => {
      main.append(el("span", { class: "hero-days", text: String(p.n) }));
      main.append(el("span", { class: "hero-unit", text: unitName(p.unit, p.n) }));
    });
    if (tx.tail) main.append(el("span", { class: "hero-unit", text: tx.tail }));
  }

  const card = el("div", { class: "hero", style: `--c1:${color};--c2:${lighten(color, 0.3)}`, onclick: () => openEditor(e.id) }, [
    el("div", { class: "hero-top" }, [
      el("span", { class: "hero-title", text: e.title }),
      el("span", { class: "hero-tag", text: tagLabel(e.tag) }),
    ]),
    main,
    el("div", { class: "hero-sub" }, parts.map((s) => el("span", { text: s }))),
  ]);
  hero.append(card);
}

function renderFilters() {
  const box = $("#filters");
  box.innerHTML = "";
  const present = new Set(state.events.map((e) => e.tag));
  const ordered = [
    ...BUILTIN_TAGS.map((x) => x.name).filter((n) => present.has(n)),
    ...[...present].filter((n) => !BUILTIN_TAGS.some((x) => x.name === n)).sort(),
  ];
  if (state.filter !== "__all__" && !ordered.includes(state.filter)) state.filter = "__all__";
  const mk = (name, label) =>
    el("button", {
      class: "chip" + (state.filter === name ? " active" : ""),
      type: "button",
      onclick: () => { state.filter = name; renderHome(); },
    }, [name !== "__all__" ? el("span", { class: "dot", style: `--c:${tagColor(name)}` }) : null, label]);
  box.append(mk("__all__", t("home.filter.all")));
  ordered.forEach((n) => box.append(mk(n, tagLabel(n))));
  box.classList.toggle("hidden", ordered.length <= 1);
}

function renderList(items) {
  const list = $("#list");
  list.innerHTML = "";
  for (const { e, c } of items) {
    const color = tagColor(e.tag);
    const tx = daysText(e, c);
    const multi = tx.parts.length > 1;
    const num = el("span", { class: "num" + (multi ? " multi" : ""), style: tx.isToday ? "font-size:18px" : "" }, renderParts(tx));
    const li = el("li", {
      class: "item" + (tx.past ? " past" : "") + (tx.isToday ? " today" : ""),
      style: `--c:${color}`,
      onclick: () => openEditor(e.id),
    }, [
      el("div", { class: "meta" }, [
        el("div", { class: "title" }, [
          el("span", { class: "name", text: e.title }),
          el("span", { class: "badge", text: tagLabel(e.tag) }),
          e.pinned ? el("span", { class: "badge pin", text: t("home.pinned") }) : null,
        ]),
        el("div", { class: "sub", text: subParts(e, c).join(" · ") }),
      ]),
      el("div", { class: "days" }, [
        el("span", { class: "label", text: tx.label || "\u00a0" }),
        num,
      ]),
    ]);
    list.append(li);
  }
}

function fitTodayLine() {
  const node = $("#today-line");
  node.classList.remove("hidden");
  const brand = node.parentElement;
  if (brand.scrollWidth > brand.clientWidth + 1) node.classList.add("hidden");
}

function renderHome() {
  const now = today();
  const lunarNow = solarToLunar(now);
  const line = t("date.today.line", { m: now.m, d: now.d, w: weekdayName(now) });
  const node = $("#today-line");
  node.textContent = line;
  node.title = lunarNow ? `${line} · ${t("date.today.lunar", { v: formatLunar(lunarNow) })}` : line;
  fitTodayLine();
  $("#btn-lang").textContent = getLang() === "zh" ? "EN" : "中";

  const all = sortedEvents();
  renderFilters();
  const items = state.filter === "__all__" ? all : all.filter((x) => x.e.tag === state.filter);
  renderHero(items);
  renderList(items.slice(1));
  $("#empty").classList.toggle("hidden", state.events.length > 0);
  $("#list").classList.toggle("hidden", state.events.length === 0);
  $("#review-prompt").classList.toggle("hidden", state.events.length < 5 || !!state.settings.reviewPromptHidden);
  $("#foot").textContent = state.events.length ? t("home.foot", { n: state.events.length }) : "";
}

// ---------- 编辑 ----------
function blankDraft() {
  const d = today();
  return {
    id: newId(),
    title: "",
    calendar: "solar",
    solar: { ...d },
    lunar: solarToLunar(d),
    time: "",
    repeat: { unit: "none", every: 1 },
    display: "days",
    tag: "纪念日",
    remind: { enabled: false, before: [{ n: 0, unit: "day" }], every: [] },
    pinned: false,
    note: "",
  };
}

function openEditor(id) {
  state.editingId = id || null;
  if (id) {
    const e = state.events.find((x) => x.id === id);
    if (!e) return;
    state.draft = JSON.parse(JSON.stringify(e));
    state.draft.repeat = normalizeRepeat(state.draft.repeat);
    if (!state.draft.display) state.draft.display = "days";
    if (!state.draft.lunar) state.draft.lunar = solarToLunar(state.draft.solar) || solarToLunar(today());
    if (!state.draft.solar) state.draft.solar = lunarToSolar(state.draft.lunar) || today();
    $("#edit-heading").textContent = t("edit.edit");
    $("#btn-delete").classList.remove("hidden");
  } else {
    state.draft = blankDraft();
    $("#edit-heading").textContent = t("edit.new");
    $("#btn-delete").classList.add("hidden");
  }
  const r = normalizeRepeat(state.draft.repeat);
  state.repeatCustomUi = r.unit !== "none" && r.every !== 1;
  state.remindCustomOpen = false;
  fillForm();
  showView("view-edit");
  if (!id) setTimeout(() => $("#f-title").focus(), 50);
}

function setSegmented(id, value) {
  $("#" + id).querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === value));
}

function weekdayIndex(ymd) {
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
}

function syncCalCursor() {
  const d = state.draft;
  if (d.calendar === "lunar") {
    const L = d.lunar;
    state.calCursor = { y: L.year, m: L.month, leap: !!L.isLeap };
  } else {
    state.calCursor = { y: d.solar.y, m: d.solar.m, leap: false };
  }
}

function yearPageStart(y) {
  return Math.floor((y - LUNAR_MIN_YEAR) / 12) * 12 + LUNAR_MIN_YEAR;
}

function clampLunarCursor(y, m, leap) {
  const info = lunarYearInfo(y);
  if (!info) return { y, m, leap: false };
  if (leap && !info.months.some((x) => x.month === m && x.isLeap)) leap = false;
  if (!info.months.some((x) => x.month === m && x.isLeap === !!leap)) {
    const first = info.months[0];
    return { y, m: first.month, leap: first.isLeap };
  }
  return { y, m, leap: !!leap };
}

function shiftCal(delta) {
  const c = state.calCursor;
  if (!c) return;
  const view = state.calView || "day";
  const lunarMode = state.draft.calendar === "lunar";
  if (view === "year") {
    const start = yearPageStart(c.y) + delta * 12;
    if (start > LUNAR_MAX_YEAR || start + 11 < LUNAR_MIN_YEAR) return;
    state.calCursor = { ...c, y: Math.min(LUNAR_MAX_YEAR, Math.max(LUNAR_MIN_YEAR, start)) };
    renderCalendar();
    return;
  }
  if (view === "month") {
    const y = c.y + delta;
    if (y < LUNAR_MIN_YEAR || y > LUNAR_MAX_YEAR) return;
    state.calCursor = lunarMode ? clampLunarCursor(y, c.m, c.leap) : { y, m: c.m, leap: false };
    renderCalendar();
    return;
  }
  if (!lunarMode) {
    let y = c.y, m = c.m + delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    if (y < LUNAR_MIN_YEAR || y > LUNAR_MAX_YEAR) return;
    state.calCursor = { y, m, leap: false };
  } else {
    let y = c.y;
    let info = lunarYearInfo(y);
    if (!info) return;
    let idx = info.months.findIndex((x) => x.month === c.m && x.isLeap === !!c.leap);
    if (idx < 0) idx = 0;
    idx += delta;
    while (idx < 0) {
      y--;
      info = lunarYearInfo(y);
      if (!info) return;
      idx += info.months.length;
    }
    while (info && idx >= info.months.length) {
      idx -= info.months.length;
      y++;
      info = lunarYearInfo(y);
      if (!info) return;
    }
    const mm = info.months[idx];
    state.calCursor = { y, m: mm.month, leap: mm.isLeap };
  }
  renderCalendar();
}

function pickCalYear(y) {
  const c = state.calCursor;
  state.calCursor = state.draft.calendar === "lunar" ? clampLunarCursor(y, c.m, c.leap) : { ...c, y, leap: false };
  state.calView = "month";
  renderCalendar();
}

function pickCalMonth(m, leap) {
  state.calCursor = { ...state.calCursor, m, leap: !!leap };
  state.calView = "day";
  renderCalendar();
}

function onCalTitle() {
  const view = state.calView || "day";
  if (view === "day") state.calView = "month";
  else if (view === "month") state.calView = "year";
  else return;
  renderCalendar();
}

function appendPickCell(grid, { text, selected, isToday, onclick }) {
  grid.append(el("button", {
    type: "button",
    class: "cal-cell pick" + (selected ? " selected" : "") + (isToday ? " today" : ""),
    onclick,
  }, [el("span", { class: "n", text })]));
}

function renderYearPicker(cur) {
  const start = yearPageStart(cur.y);
  const end = Math.min(start + 11, LUNAR_MAX_YEAR);
  $("#cal-title").textContent = t("cal.years", { from: start, to: end });
  const grid = $("#cal-grid");
  grid.innerHTML = "";
  grid.className = "cal-grid pick years";
  const nowY = today().y;
  for (let y = start; y <= end; y++) {
    appendPickCell(grid, {
      text: String(y),
      selected: y === cur.y,
      isToday: y === nowY,
      onclick: () => pickCalYear(y),
    });
  }
}

function renderMonthPicker(cur, lunarMode) {
  $("#cal-title").textContent = t("cal.year", { y: cur.y });
  const grid = $("#cal-grid");
  grid.innerHTML = "";
  grid.className = "cal-grid pick months";
  const now = today();
  const nowL = solarToLunar(now);
  if (!lunarMode) {
    const labels = t("cal.months");
    for (let m = 1; m <= 12; m++) {
      appendPickCell(grid, {
        text: labels[m - 1],
        selected: m === cur.m,
        isToday: now.y === cur.y && now.m === m,
        onclick: () => pickCalMonth(m, false),
      });
    }
    return;
  }
  const info = lunarYearInfo(cur.y);
  if (!info) return;
  for (const mm of info.months) {
    appendPickCell(grid, {
      text: lunarMonthName(mm.month, mm.isLeap),
      selected: mm.month === cur.m && !!mm.isLeap === !!cur.leap,
      isToday: nowL && nowL.year === cur.y && nowL.month === mm.month && !!nowL.isLeap === mm.isLeap,
      onclick: () => pickCalMonth(mm.month, mm.isLeap),
    });
  }
}

function pickSolar(ymd) {
  const d = state.draft;
  d.solar = { ...ymd };
  d.lunar = solarToLunar(d.solar) || d.lunar;
  syncCalCursor();
  onDateChanged();
  renderCalendar();
}

function pickLunar(lunar) {
  const d = state.draft;
  d.lunar = { ...lunar };
  d.solar = lunarToSolar(d.lunar) || d.solar;
  syncCalCursor();
  onDateChanged();
  renderCalendar();
}

function renderCalendar() {
  if (!state.draft) return;
  if (!state.calCursor) syncCalCursor();
  const d = state.draft;
  const cur = state.calCursor;
  const lunarMode = d.calendar === "lunar";
  const view = state.calView || "day";
  const dows = t("cal.dow");
  const dowBox = $("#cal-dows");
  if (!dowBox.childElementCount || dowBox.dataset.lang !== getLang()) {
    dowBox.innerHTML = "";
    dowBox.dataset.lang = getLang();
    for (const w of dows) dowBox.append(el("span", { text: w }));
  }
  dowBox.classList.toggle("hidden", view !== "day");
  $("#cal-title").classList.toggle("drill", view !== "year");
  $("#cal-title").title = view === "day" ? t("cal.pick.month") : view === "month" ? t("cal.pick.year") : "";
  $("#cal-prev").title = t(view === "year" ? "cal.prev.years" : view === "month" ? "cal.prev.year" : "cal.prev");
  $("#cal-next").title = t(view === "year" ? "cal.next.years" : view === "month" ? "cal.next.year" : "cal.next");
  $("#cal-prev").disabled = calAtBound(-1);
  $("#cal-next").disabled = calAtBound(1);

  if (view === "year") {
    renderYearPicker(cur);
    return;
  }
  if (view === "month") {
    renderMonthPicker(cur, lunarMode);
    return;
  }

  if (lunarMode) {
    $("#cal-title").textContent = t("cal.month.lunar", { y: cur.y, month: lunarMonthName(cur.m, cur.leap) });
  } else {
    $("#cal-title").textContent = t("cal.month.solar", { y: cur.y, m: cur.m });
  }

  const grid = $("#cal-grid");
  grid.innerHTML = "";
  grid.className = "cal-grid" + (lunarMode ? " lunar" : "");
  const todayYmd = today();
  const todayL = solarToLunar(todayYmd);

  if (!lunarMode) {
    const first = { y: cur.y, m: cur.m, d: 1 };
    const pad = weekdayIndex(first);
    const dim = daysInMonth(cur.y, cur.m);
    for (let i = 0; i < pad; i++) grid.append(el("button", { type: "button", class: "cal-cell", disabled: true }));
    for (let day = 1; day <= dim; day++) {
      const ymd = { y: cur.y, m: cur.m, d: day };
      const lu = solarToLunar(ymd);
      const selected = sameYmd(ymd, d.solar);
      const isToday = sameYmd(ymd, todayYmd);
      grid.append(el("button", {
        type: "button",
        class: "cal-cell" + (selected ? " selected" : "") + (isToday ? " today" : ""),
        onclick: () => pickSolar(ymd),
      }, [
        el("span", { class: "n", text: String(day) }),
        lu ? el("span", { class: "s", text: lu.day === 1 ? lunarMonthName(lu.month, lu.isLeap) : lunarDayName(lu.day) }) : null,
      ]));
    }
    return;
  }

  const info = lunarYearInfo(cur.y);
  const mm = info && info.months.find((x) => x.month === cur.m && x.isLeap === !!cur.leap);
  if (!mm) return;
  const startSolar = mm.start;
  const pad = weekdayIndex(startSolar);
  for (let i = 0; i < pad; i++) grid.append(el("button", { type: "button", class: "cal-cell", disabled: true }));
  for (let day = 1; day <= mm.days; day++) {
    const lunar = { year: cur.y, month: cur.m, isLeap: !!cur.leap, day };
    const solar = lunarToSolar(lunar);
    const selected = d.lunar.year === lunar.year && d.lunar.month === lunar.month && !!d.lunar.isLeap === lunar.isLeap && d.lunar.day === day;
    const isToday = todayL && todayL.year === lunar.year && todayL.month === lunar.month && !!todayL.isLeap === lunar.isLeap && todayL.day === day;
    grid.append(el("button", {
      type: "button",
      class: "cal-cell" + (selected ? " selected" : "") + (isToday ? " today" : ""),
      onclick: () => pickLunar(lunar),
    }, [
      el("span", { class: "n", text: lunarDayName(day) }),
      solar ? el("span", { class: "s", text: `${solar.m}/${solar.d}` }) : null,
    ]));
  }
}

function calAtBound(dir) {
  const c = state.calCursor;
  if (!c) return true;
  const view = state.calView || "day";
  if (view === "year") {
    const start = yearPageStart(c.y);
    return dir < 0 ? start <= LUNAR_MIN_YEAR : start + 12 > LUNAR_MAX_YEAR;
  }
  if (view === "month") {
    return dir < 0 ? c.y <= LUNAR_MIN_YEAR : c.y >= LUNAR_MAX_YEAR;
  }
  if (state.draft.calendar !== "lunar") {
    return dir < 0 ? c.y <= LUNAR_MIN_YEAR && c.m <= 1 : c.y >= LUNAR_MAX_YEAR && c.m >= 12;
  }
  const info = lunarYearInfo(c.y);
  if (!info) return true;
  const idx = info.months.findIndex((x) => x.month === c.m && x.isLeap === !!c.leap);
  return dir < 0 ? c.y <= LUNAR_MIN_YEAR && idx <= 0 : c.y >= LUNAR_MAX_YEAR && idx >= info.months.length - 1;
}

function jumpCalToToday() {
  const now = today();
  if (state.draft.calendar === "lunar") {
    const L = solarToLunar(now);
    if (!L) return;
    state.calCursor = { y: L.year, m: L.month, leap: !!L.isLeap };
  } else {
    const y = Math.min(LUNAR_MAX_YEAR, Math.max(LUNAR_MIN_YEAR, now.y));
    state.calCursor = { y, m: now.m, leap: false };
  }
  state.calView = "day";
  renderCalendar();
}

function fillTags() {
  const box = $("#f-tags");
  box.innerHTML = "";
  const d = state.draft;
  const names = BUILTIN_TAGS.map((x) => x.name);
  const isCustom = !names.includes(d.tag);
  for (const n of names) {
    box.append(el("button", {
      type: "button",
      class: "chip" + (d.tag === n ? " active" : ""),
      onclick: () => { d.tag = n; $("#f-tag-custom").classList.add("hidden"); fillTags(); renderPreview(); },
    }, [el("span", { class: "dot", style: `--c:${tagColor(n)}` }), tagLabel(n)]));
  }
  box.append(el("button", {
    type: "button",
    class: "chip" + (isCustom ? " active" : ""),
    onclick: () => {
      const input = $("#f-tag-custom");
      input.classList.remove("hidden");
      input.value = names.includes(d.tag) ? "" : d.tag;
      input.focus();
      if (!input.value) d.tag = "";
      fillTags();
    },
  }, [isCustom && d.tag ? el("span", { class: "dot", style: `--c:${tagColor(d.tag)}` }) : null, isCustom && d.tag ? d.tag : t("edit.tag.custom")]));
  $("#f-tag-custom").classList.toggle("hidden", !isCustom);
}

function currentMode() {
  return computeEvent(state.draft, { includeToday: state.settings.includeToday }).mode;
}

/** 当前模式下操作的规则集合名：倒数 → before（提前 N），已过 → every（每满 N）。 */
function remindKind() {
  return currentMode() === "countdown" ? "before" : "every";
}

function ruleLabel(kind, rule) {
  return t(kind === "before" ? "edit.remind.before" : "edit.remind.every", {
    n: rule.n,
    unit: unitName(rule.unit, rule.n),
  });
}

function fillRemindOptions() {
  const d = state.draft;
  const box = $("#remind-options");
  box.classList.toggle("hidden", !d.remind.enabled);
  if (!d.remind.enabled) {
    state.remindCustomOpen = false;
    return;
  }

  const kind = remindKind();
  const rules = d.remind[kind];
  const units = kind === "before" ? REMIND_BEFORE_UNITS : REMIND_EVERY_UNITS;
  const presets = kind === "before" ? REMIND_BEFORE_PRESETS : REMIND_EVERY_PRESETS;
  const nInput = $("#rule-n");
  if (nInput.dataset.kind && nInput.dataset.kind !== kind) state.remindCustomOpen = false;

  const list = $("#remind-list");
  list.innerHTML = "";
  list.classList.toggle("hidden", !rules.length);
  for (const rule of rules) {
    list.append(el("div", { class: "stack-item" }, [
      el("span", { class: "lab", text: ruleLabel(kind, rule) }),
      el("button", {
        type: "button",
        class: "icon-btn",
        title: t("edit.remind.remove"),
        onclick: () => toggleRule(rule),
      }, ["×"]),
    ]));
  }

  const add = $("#remind-add");
  add.innerHTML = "";
  add.append(el("option", { value: "", text: t("edit.remind.add") }));
  for (const p of presets) {
    if (rules.some((r) => sameRule(r, p))) continue;
    add.append(el("option", { value: `${p.n}|${p.unit}`, text: ruleLabel(kind, p) }));
  }
  add.append(el("option", { value: "custom", text: t("repeat.custom") }));
  add.value = state.remindCustomOpen ? "custom" : "";

  $("#rule-prefix").textContent = t(kind === "before" ? "edit.remind.prefix.before" : "edit.remind.prefix.every");
  nInput.min = kind === "before" ? "0" : "1";
  if (!nInput.dataset.kind || nInput.dataset.kind !== kind) {
    nInput.value = kind === "before" ? "1" : "100";
    nInput.dataset.kind = kind;
  }
  const uSel = $("#rule-unit");
  const prevUnit = uSel.value;
  uSel.innerHTML = "";
  const n = parseInt(nInput.value, 10) || 1;
  for (const u of units) uSel.append(el("option", { value: u, text: unitName(u, n) }));
  uSel.value = units.includes(prevUnit) ? prevUnit : "day";
  $("#remind-custom").classList.toggle("hidden", !state.remindCustomOpen);
}

function toggleRule(raw) {
  const d = state.draft;
  const kind = remindKind();
  const units = kind === "before" ? REMIND_BEFORE_UNITS : REMIND_EVERY_UNITS;
  const rule = normalizeRule(raw, { allowZero: kind === "before", units });
  if (!rule) return;
  const has = d.remind[kind].some((r) => sameRule(r, rule));
  d.remind[kind] = has
    ? d.remind[kind].filter((r) => !sameRule(r, rule))
    : [...d.remind[kind], rule].sort((a, b) => ruleDays(a) - ruleDays(b));
  fillRemindOptions();
}

function addRule(raw) {
  const d = state.draft;
  const kind = remindKind();
  const units = kind === "before" ? REMIND_BEFORE_UNITS : REMIND_EVERY_UNITS;
  const rule = normalizeRule(raw, { allowZero: kind === "before", units });
  if (!rule) return;
  if (d.remind[kind].some((r) => sameRule(r, rule))) { toast(t("edit.remind.exists")); fillRemindOptions(); return; }
  d.remind[kind] = [...d.remind[kind], rule].sort((a, b) => ruleDays(a) - ruleDays(b));
  fillRemindOptions();
}

function fillRepeat() {
  const r = state.draft.repeat;
  const custom = state.repeatCustomUi || (r.unit !== "none" && r.every !== 1);
  $("#f-repeat").value = r.unit === "none" ? "none" : custom ? "custom" : r.unit;
  $("#repeat-custom").classList.toggle("hidden", !custom);
  if (!custom) return;
  $("#f-every").value = String(r.every);
  const unit = r.unit === "none" ? "year" : r.unit;
  const sel = $("#f-repeat-unit");
  for (const opt of sel.options) opt.textContent = unitName(opt.value, r.every);
  sel.value = unit;
}

function fillForm() {
  const d = state.draft;
  $("#f-title").value = d.title;
  setSegmented("f-calendar", d.calendar);
  state.calView = "day";
  syncCalCursor();
  renderCalendar();
  fillRepeat();
  $("#f-display").value = d.display || "days";
  fillTags();
  $("#f-remind").checked = d.remind.enabled;
  fillRemindOptions();
  $("#f-pinned").checked = d.pinned;
  $("#f-note").value = d.note || "";
  updateHints();
  renderPreview();
}

function updateHints() {
  const d = state.draft;
  if (d.calendar === "solar") {
    const l = solarToLunar(d.solar);
    $("#date-hint").textContent = l ? t("edit.date.hint.lunar", { v: formatLunar(l, { withYear: true }) }) : "";
  } else {
    const s = lunarToSolar(d.lunar);
    $("#date-hint").textContent = s ? t("edit.date.hint.solar", { v: `${ymdToStr(s)} ${weekdayName(s)}` }) : t("edit.date.invalid");
  }
}

function renderPreview() {
  const d = state.draft;
  const box = $("#preview");
  box.innerHTML = "";
  const c = computeEvent(d, { includeToday: state.settings.includeToday });
  if (c.invalid) {
    box.append(el("div", { class: "p-text" }, [el("div", { class: "p-main", text: t("edit.invalid") })]));
    return;
  }
  const tx = daysText(d, c);
  const title = d.title.trim() || t("edit.untitled");
  const main = t(tx.isToday ? "preview.today" : c.mode === "countup" ? "preview.countup" : "preview.countdown", { title });
  box.style.setProperty("--primary", tagColor(d.tag || "其他"));
  box.append(
    el("div", { class: "p-text" }, [el("div", { class: "p-main", text: main }), el("div", { class: "p-sub", text: subParts(d, c).join(" · ") })]),
    el("div", { class: "p-days" + (tx.parts.length > 1 ? " multi" : "") }, renderParts(tx))
  );
}

function onDateChanged() {
  fillRemindOptions();
  updateHints();
  renderPreview();
}

function bindEditor() {
  $("#f-title").addEventListener("input", (e) => { state.draft.title = e.target.value; renderPreview(); });

  $("#f-calendar").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    const d = state.draft;
    const next = btn.dataset.value;
    if (next === d.calendar) return;
    if (next === "lunar") d.lunar = solarToLunar(d.solar) || d.lunar;
    else d.solar = lunarToSolar(d.lunar) || d.solar;
    d.calendar = next;
    fillForm();
  });

  $("#cal-prev").addEventListener("click", () => shiftCal(-1));
  $("#cal-next").addEventListener("click", () => shiftCal(1));
  $("#cal-title").addEventListener("click", onCalTitle);
  $("#cal-today").addEventListener("click", jumpCalToToday);

  $("#f-repeat").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "none") {
      state.repeatCustomUi = false;
      state.draft.repeat = normalizeRepeat({ unit: "none", every: 1 });
    } else if (v === "custom") {
      state.repeatCustomUi = true;
      const cur = state.draft.repeat;
      state.draft.repeat = normalizeRepeat({
        unit: cur.unit === "none" ? "year" : cur.unit,
        every: cur.every || 1,
      });
    } else {
      state.repeatCustomUi = false;
      state.draft.repeat = normalizeRepeat({ unit: v, every: 1 });
    }
    fillRepeat();
    onDateChanged();
  });
  $("#f-repeat-unit").addEventListener("change", (e) => {
    state.draft.repeat = normalizeRepeat({ unit: e.target.value, every: state.draft.repeat.every });
    fillRepeat();
    onDateChanged();
  });
  $("#f-every").addEventListener("input", (e) => {
    const n = parseInt(e.target.value, 10);
    if (!Number.isInteger(n) || n < 1) return;
    state.draft.repeat = normalizeRepeat({ unit: state.draft.repeat.unit, every: n });
    const sel = $("#f-repeat-unit");
    for (const opt of sel.options) opt.textContent = unitName(opt.value, n);
    onDateChanged();
  });
  $("#f-every").addEventListener("blur", fillRepeat);
  $("#f-display").addEventListener("change", (e) => { state.draft.display = e.target.value; renderPreview(); });
  $("#f-tag-custom").addEventListener("input", (e) => { state.draft.tag = e.target.value.trim(); fillTagsLite(); renderPreview(); });
  $("#f-remind").addEventListener("change", (e) => {
    state.draft.remind.enabled = e.target.checked;
    if (e.target.checked && remindKind() === "before" && !state.draft.remind.before.length) {
      state.draft.remind.before = [{ n: 0, unit: "day" }];
    }
    if (e.target.checked && remindKind() === "every" && !state.draft.remind.every.length) {
      state.draft.remind.every = [{ n: 1, unit: "year" }];
      toast(t("edit.remind.default.every"));
    }
    fillRemindOptions();
  });
  $("#remind-add").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "custom") {
      state.remindCustomOpen = true;
      fillRemindOptions();
      $("#rule-n").focus();
      return;
    }
    state.remindCustomOpen = false;
    if (v) {
      const [n, unit] = v.split("|");
      addRule({ n, unit });
    } else {
      fillRemindOptions();
    }
  });
  $("#rule-add").addEventListener("click", () => {
    addRule({ n: $("#rule-n").value, unit: $("#rule-unit").value });
    state.remindCustomOpen = false;
    fillRemindOptions();
  });
  $("#rule-n").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#rule-add").click(); } });
  $("#rule-n").addEventListener("input", () => {
    const n = parseInt($("#rule-n").value, 10) || 1;
    for (const opt of $("#rule-unit").options) opt.textContent = unitName(opt.value, n);
  });
  $("#f-pinned").addEventListener("change", (e) => { state.draft.pinned = e.target.checked; });
  $("#f-note").addEventListener("input", (e) => { state.draft.note = e.target.value; });

  $("#btn-back").addEventListener("click", () => showView("view-home"));
  $("#btn-save").addEventListener("click", save);
  $("#btn-donate-edit").addEventListener("click", openDonate);
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); save(); });
  $("#btn-delete").addEventListener("click", async () => {
    if (!state.editingId) return;
    if (!confirm(t("edit.delete.confirm", { title: state.draft.title }))) return;
    await deleteEvent(state.editingId);
    await reload();
    showView("view-home");
    toast(t("edit.deleted"));
  });
}

// 自定义标签输入时只更新“自定义”chip 文案，避免输入框失焦
function fillTagsLite() {
  const chips = $("#f-tags").querySelectorAll(".chip");
  const last = chips[chips.length - 1];
  const name = state.draft.tag;
  last.innerHTML = "";
  if (name) last.append(el("span", { class: "dot", style: `--c:${tagColor(name)}` }));
  last.append(name || t("edit.tag.custom"));
}

async function save() {
  const d = state.draft;
  d.title = d.title.trim();
  if (!d.title) { toast(t("edit.need.title")); $("#f-title").focus(); return; }
  if (!d.tag) d.tag = "其他";
  const payload = { ...d };
  if (payload.calendar === "solar") delete payload.lunar;
  else delete payload.solar;
  try {
    await upsertEvent(payload);
  } catch (err) {
    toast(t("edit.save.failed", { msg: err && err.message ? err.message : err }));
    return;
  }
  const wasEditing = !!state.editingId;
  state.editingId = null;
  await reload();
  showView("view-home");
  toast(t(wasEditing ? "edit.saved" : "edit.added"));
}

// ---------- 语言 ----------
async function toggleLang() {
  const next = getLang() === "zh" ? "en" : "zh";
  setLang(next);
  await saveSettings({ language: next });
  applyLanguage();
}

function applyLanguage() {
  applyDom();
  renderHome();
  if (!$("#view-edit").classList.contains("hidden") && state.draft) {
    $("#edit-heading").textContent = t(state.editingId ? "edit.edit" : "edit.new");
    fillForm();
  }
}

// ---------- 初始化 ----------
async function reload() {
  [state.events, state.settings] = await Promise.all([loadEvents(), loadSettings()]);
  const lang = state.settings.language === "zh" || state.settings.language === "en" ? state.settings.language : null;
  if (lang && lang !== getLang()) { setLang(lang); applyDom(); }
  renderHome();
}

function bindHome() {
  $("#btn-add").addEventListener("click", () => openEditor(null));
  $("#btn-add-empty").addEventListener("click", () => openEditor(null));
  $("#btn-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#btn-lang").addEventListener("click", toggleLang);
  $("#btn-donate").addEventListener("click", openDonate);
  $("#btn-review-go").addEventListener("click", async () => {
    await hideReviewPrompt();
    openStoreReview();
  });
  $("#btn-review-hide").addEventListener("click", hideReviewPrompt);
}

async function init() {
  await initI18n(loadSettings);
  applyDom();
  bindHome();
  bindEditor();
  await reload();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(changes.events || changes.settings)) return;
    const langChanged = changes.settings && (changes.settings.oldValue || {}).language !== (changes.settings.newValue || {}).language;
    reload().then(() => { if (langChanged) applyLanguage(); });
  });
}

init();
