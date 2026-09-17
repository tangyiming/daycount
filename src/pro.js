// Pro 门禁。付 USDT 后开发者发兑换码；未打包扩展可用开发者开关。
import { loadSettings, saveSettings } from "./store.js";

export const FREE_EVENT_LIMIT = 5;
export const USDT_AMOUNT = "5";
export const PAY_EMAIL = "backtym@gmail.com";
export const USDT_WALLETS = [
  { id: "bsc", chain: "BSC", token: "USDT (BEP-20)", address: "0x6E7359A42C466893E9A835fD6aFdb82E0D1Ed32d" },
  { id: "sol", chain: "Solana", token: "USDT", address: "Hm7f6wGdvcmLmbcXV7sdLYGJKBdwGoFrJTZPzeN8dpan" },
  { id: "tron", chain: "Tron", token: "USDT (TRC-20)", address: "TGNrpZBqD8jnfNCb7B9W93qMmVHycoFsKJ" },
];

const LICENSE_SEED = "daycount-pro-v1-n7q2";

export function isUnpacked() {
  return !chrome.runtime.getManifest().update_url;
}

async function hmacHex(message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(LICENSE_SEED),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeLicense(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function isValidLicense(raw) {
  const code = normalizeLicense(raw);
  const m = /^DC-([0-9A-F]{6})-([0-9A-F]{8})$/.exec(code);
  if (!m) return false;
  const expect = (await hmacHex(`daycount:${m[1]}`)).slice(0, 8).toUpperCase();
  return expect === m[2];
}

export async function mintLicense() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const id = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const sig = (await hmacHex(`daycount:${id}`)).slice(0, 8).toUpperCase();
  return `DC-${id}-${sig}`;
}

export async function getPro() {
  const settings = await loadSettings().catch(() => ({}));
  if (settings.proDev && isUnpacked()) {
    return { paid: true, source: "dev" };
  }
  if (await isValidLicense(settings.proLicense)) {
    return { paid: true, source: "license" };
  }
  return { paid: false, source: "local" };
}

export async function redeemLicense(raw) {
  const code = normalizeLicense(raw);
  if (!(await isValidLicense(code))) return false;
  await saveSettings({ proLicense: code });
  return true;
}

export async function setDevPro(on) {
  if (!isUnpacked()) return;
  await saveSettings({ proDev: !!on });
}

export async function clearPro() {
  await saveSettings({ proLicense: "", proDev: false });
}

export function canAddEvent(events, editingId, paid) {
  if (paid || editingId) return true;
  return (events || []).length < FREE_EVENT_LIMIT;
}

export function payMailto() {
  const subject = encodeURIComponent("DayCount Pro");
  const body = encodeURIComponent("Chain:\nTx:\n");
  return `mailto:${PAY_EMAIL}?subject=${subject}&body=${body}`;
}
