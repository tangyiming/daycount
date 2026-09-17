import { loadEvents, saveEvents, loadSettings, saveSettings, buildExport, parseImport, mergeEvents } from "../src/store.js";
import { t, initI18n, setLang, resolveLang, applyDom } from "../src/i18n.js";
import { getPro, setDevPro, clearPro, isUnpacked, FREE_EVENT_LIMIT, USDT_AMOUNT, PAY_EMAIL, USDT_WALLETS, redeemLicense, mintLicense, payMailto } from "../src/pro.js";

const $ = (sel) => document.querySelector(sel);

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

async function refreshCount() {
  const events = await loadEvents();
  $("#count").textContent = String(events.length);
}

async function syncSettingsToForm() {
  const s = await loadSettings();
  $("#s-language").value = s.language || "auto";
  $("#s-remind-time").value = s.remindTime;
  $("#s-badge").checked = s.badge !== "none";
  $("#s-include-today").checked = !!s.includeToday;
}

function renderNotificationStatus() {
  const status = $("#notif-status");
  if (chrome.notifications && chrome.notifications.getPermissionLevel) {
    chrome.notifications.getPermissionLevel((level) => {
      status.textContent = t(level === "granted" ? "opt.notif.granted" : "opt.notif.denied");
    });
  } else {
    status.textContent = t("opt.notif.unsupported");
  }
}

function applyLanguage() {
  applyDom();
  renderNotificationStatus();
  renderPro();
}

function renderWallets() {
  const box = $("#pro-wallets");
  box.replaceChildren();
  for (const w of USDT_WALLETS) {
    const addr = document.createElement("div");
    addr.className = "wallet-addr";
    addr.textContent = w.address;
    const copy = document.createElement("button");
    copy.className = "btn small";
    copy.textContent = t("opt.pro.copy");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(w.address);
        toast(t("opt.pro.copied"));
      } catch {
        toast(w.address);
      }
    });
    const text = document.createElement("div");
    text.className = "wallet-text";
    const title = document.createElement("b");
    title.textContent = `${w.chain} · ${w.token}`;
    text.append(title, addr);
    const row = document.createElement("div");
    row.className = "wallet";
    row.append(text, copy);
    box.append(row);
  }
}

async function renderPro() {
  const pro = await getPro();
  $("#pro-desc").textContent = t("opt.pro.desc", { n: FREE_EVENT_LIMIT });
  let status = t("opt.pro.free");
  if (pro.source === "dev") status = t("opt.pro.active") + " · dev";
  else if (pro.source === "license") status = t("opt.pro.active");
  else if (pro.paid) status = t("opt.pro.active");
  $("#pro-status").textContent = status;
  $("#btn-pro-clear").classList.toggle("hidden", !pro.paid);
  $("#pro-pay").classList.toggle("hidden", !!pro.paid);
  $("#pro-pay-hint").textContent = t("opt.pro.pay.hint", { n: USDT_AMOUNT, email: PAY_EMAIL });
  const mail = $("#pro-mail");
  mail.href = payMailto();
  mail.textContent = t("opt.pro.pay.mail", { email: PAY_EMAIL });
  renderWallets();
  const unpacked = isUnpacked();
  $("#pro-dev-row").classList.toggle("hidden", !unpacked);
  $("#pro-mint-row").classList.toggle("hidden", !unpacked);
  if (unpacked) {
    const s = await loadSettings();
    $("#s-pro-dev").checked = !!s.proDev;
  }
}

async function initPro() {
  await renderPro();
  $("#btn-pro-redeem").addEventListener("click", async () => {
    const code = $("#pro-code").value;
    if (!String(code || "").trim()) {
      toast(t("opt.pro.redeem.empty"));
      return;
    }
    const ok = await redeemLicense(code);
    toast(t(ok ? "opt.pro.redeem.ok" : "opt.pro.redeem.bad"));
    if (ok) {
      $("#pro-code").value = "";
      await renderPro();
    }
  });
  $("#pro-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#btn-pro-redeem").click();
  });
  $("#s-pro-dev").addEventListener("change", async (e) => {
    await setDevPro(e.target.checked);
    toast(t(e.target.checked ? "opt.pro.dev.on" : "opt.pro.dev.off"));
    await renderPro();
  });
  $("#btn-pro-clear").addEventListener("click", async () => {
    await clearPro();
    toast(t("opt.pro.clear.ok"));
    await renderPro();
  });
  $("#btn-pro-mint").addEventListener("click", async () => {
    const code = await mintLicense();
    $("#pro-mint-out").textContent = code;
    try {
      await navigator.clipboard.writeText(code);
      toast(t("opt.pro.mint.copied"));
    } catch {
      toast(code);
    }
  });
}

async function initSettings() {
  await syncSettingsToForm();

  $("#s-language").addEventListener("change", async (e) => {
    const v = e.target.value;
    await saveSettings({ language: v });
    setLang(resolveLang(v));
    applyLanguage();
    toast(t("opt.saved"));
  });
  $("#s-remind-time").addEventListener("change", async (e) => {
    const v = e.target.value;
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    await saveSettings({ remindTime: v });
    toast(t("opt.remind.time.saved", { v }));
  });
  $("#s-badge").addEventListener("change", async (e) => {
    await saveSettings({ badge: e.target.checked ? "top" : "none" });
    toast(t(e.target.checked ? "opt.badge.on" : "opt.badge.off"));
  });
  $("#s-include-today").addEventListener("change", async (e) => {
    await saveSettings({ includeToday: e.target.checked });
    toast(t("opt.saved"));
  });
}

function initNotification() {
  renderNotificationStatus();
  $("#btn-test-notif").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "test-notification" }, (resp) => {
      if (chrome.runtime.lastError) toast(t("opt.notif.test.failed") + ": " + chrome.runtime.lastError.message);
      else toast(t(resp && resp.ok ? "opt.notif.test.sent" : "opt.notif.test.failed"));
    });
  });
}

function initBackup() {
  $("#btn-export").addEventListener("click", async () => {
    const [events, settings] = await Promise.all([loadEvents(), loadSettings()]);
    const text = buildExport(events, settings);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const name = `daycount-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(t("opt.export.done", { n: events.length }));
  });

  $("#btn-import").addEventListener("click", () => $("#file-import").click());
  $("#file-import").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const log = $("#import-log");
    log.classList.add("hidden");
    try {
      const text = await file.text();
      const { events, settings, errors } = parseImport(text);
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const existing = await loadEvents();
      if (mode === "replace") {
        if (!confirm(t("opt.import.confirm", { a: existing.length, b: events.length }))) return;
      }
      const merged = mode === "replace" ? events : mergeEvents(existing, events);
      await saveEvents(merged);
      if (Object.keys(settings).length) await saveSettings(settings);
      const lines = [t("opt.import.result", { n: events.length, mode: t("opt.import.mode." + mode), total: merged.length })];
      if (errors.length) lines.push(...errors);
      log.textContent = lines.join("\n");
      log.classList.remove("hidden");
      await refreshCount();
      await syncSettingsToForm();
      if (settings.language) { setLang(resolveLang(settings.language)); applyLanguage(); }
      toast(t("opt.import.ok"));
    } catch (err) {
      log.textContent = t("opt.import.failed.msg", { msg: err && err.message ? err.message : String(err) });
      log.classList.remove("hidden");
      toast(t("opt.import.failed"));
    }
  });

  $("#btn-clear").addEventListener("click", async () => {
    const events = await loadEvents();
    if (!events.length) { toast(t("opt.clear.empty")); return; }
    if (!confirm(t("opt.clear.confirm", { n: events.length }))) return;
    await saveEvents([]);
    await refreshCount();
    toast(t("opt.clear.done"));
  });
}

async function init() {
  await initI18n(loadSettings);
  applyDom();
  $("#version").textContent = chrome.runtime.getManifest().version;
  await initSettings();
  await initPro();
  initNotification();
  initBackup();
  await refreshCount();
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local") return;
    if (changes.events) refreshCount();
    if (changes.settings) {
      const oldL = (changes.settings.oldValue || {}).language;
      const newL = (changes.settings.newValue || {}).language;
      if (oldL !== newL) {
        setLang(resolveLang(newL));
        applyLanguage();
        $("#s-language").value = newL || "auto";
      } else {
        renderPro();
      }
    }
  });
}

init();
