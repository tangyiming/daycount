// 界面多语言：简体中文 / English。语言由设置 language（auto | zh | en）决定，auto 跟随浏览器语言。
// 字典值可以是字符串（支持 {name} 占位）或函数（用于单复数等复杂规则）。

export const LANGS = ["zh", "en"];

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const zh = {
  "app.name": "倒数日",
  "app.tagline": "设置与数据备份。所有数据只保存在本机浏览器中，不会上传到任何服务器。",

  "common.new": "新建",
  "common.save": "保存",
  "common.back": "返回",
  "common.settings": "设置与数据备份",
  "common.language": "切换语言 / Language",
  "common.optional": "可选",

  "home.empty.title": "还没有任何倒数日",
  "home.empty.desc": "添加生日、纪念日、考试、发薪日……\n每天打开浏览器就能看到。",
  "home.empty.cta": "添加第一个事件",
  "home.foot": "已保存 {n} 个 · 只存在这台电脑",
  "home.donate": "喜欢就请开发者喝杯咖啡 →",
  "home.donate.title": "打赏开发者",
  "home.filter.all": "全部",
  "home.pinned": "置顶",

  "edit.new": "新建事件",
  "edit.edit": "编辑事件",
  "edit.title": "标题",
  "edit.title.placeholder": "例如：结婚纪念日、宝宝出生、考研倒计时",
  "edit.date": "日期",
  "edit.calendar.solar": "阳历",
  "edit.calendar.lunar": "农历",
  "edit.date.hint.lunar": "对应农历：{v}",
  "edit.date.hint.solar": "对应阳历：{v}",
  "edit.date.invalid": "该农历日期不存在",
  "cal.dow": ["日", "一", "二", "三", "四", "五", "六"],
  "cal.month.solar": "{y}年{m}月",
  "cal.month.lunar": "{y}年{month}",
  "cal.months": ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  "cal.year": "{y}年",
  "cal.years": "{from} – {to}",
  "cal.prev": "上一月",
  "cal.next": "下一月",
  "cal.prev.year": "上一年",
  "cal.next.year": "下一年",
  "cal.prev.years": "更早的年份",
  "cal.next.years": "更晚的年份",
  "cal.today": "今",
  "cal.today.hint": "回到今天",
  "cal.pick.month": "选择月份",
  "cal.pick.year": "选择年份",
  "edit.repeat": "循环",
  "edit.repeat.every": "每",
  "edit.display": "显示方式",
  "edit.tag": "标签",
  "edit.tag.custom": "自定义…",
  "edit.tag.custom.placeholder": "输入自定义标签名",
  "edit.remind": "提醒",
  "edit.remind.onday": "当天",
  "edit.remind.before": ({ n, unit }) => (n === 0 ? "当天" : `提前 ${n} ${unit}`),
  "edit.remind.every": ({ n, unit }) => `每满 ${n} ${unit}`,
  "edit.remind.add": "添加提醒",
  "edit.remind.add.ok": "添加",
  "edit.remind.remove": "删除",
  "edit.remind.exists": "这条提醒已存在",
  "edit.remind.prefix.before": "提前",
  "edit.remind.prefix.every": "每满",
  "edit.remind.default.every": "已过的日子默认每年提醒一次，可再增删",
  "edit.pin": "置顶显示",
  "edit.pin.desc": "占顶部大卡片和图标角标。同时只能置顶 1 个，开启会替换当前置顶。",
  "edit.note": "备注",
  "edit.delete": "删除此事件",
  "edit.delete.confirm": "确定删除「{title}」吗？此操作不可撤销。",
  "edit.untitled": "（未命名）",
  "edit.invalid": "日期无效",
  "edit.need.title": "请填写标题",
  "edit.save.failed": "保存失败：{msg}",
  "edit.saved": "已保存",
  "edit.added": "已添加",
  "edit.deleted": "已删除",

  "preview.countdown": "距离 {title} 还有",
  "preview.past": "{title} 已过",
  "preview.today": "{title} 就是今天",
  "preview.countup": "{title} 已经",

  "repeat.none": "不重复",
  "repeat.day": "每天",
  "repeat.week": "每周",
  "repeat.month": "每月",
  "repeat.year": "每年",
  "repeat.custom": "自定义…",
  "unit.day": "天",
  "unit.week": "周",
  "unit.month": "个月",
  "unit.year": "年",
  "unit.week.short": "周",
  "unit.month.short": "月",
  "unit.year.short": "年",
  "unit.day.short": "天",

  "display.days": "天",
  "display.weeks": "周 + 天",
  "display.months": "月 + 天",
  "display.years": "年 + 月 + 天",

  "cycle.anniversary": "{n} 周年",
  "cycle.nth": "第 {n} 次",
  "cycle.since": "已经 {n} 天",

  "tag.纪念日": "纪念日",
  "tag.生活": "生活",
  "tag.工作": "工作",
  "tag.学习": "学习",
  "tag.节日": "节日",
  "tag.其他": "其他",

  // 天数展示：label 在数字前，unit 在数字后
  "days.left.label": "还有",
  "days.left.unit": "天",
  "days.left.tail": "",
  "days.since.label": "已经",
  "days.since.unit": "天",
  "days.since.tail": "",
  "days.ago.label": "已过",
  "days.ago.unit": "天",
  "days.today.label": "就是",
  "days.today": "今天",

  "human.years": ({ y, d }) => (d > 0 ? `约 ${y} 年 ${d} 天` : `约 ${y} 年`),

  "date.lunar.prefix": "农历",
  "date.weekday": ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  "date.today.line": ({ m, d, w }) => `${m}月${d}日 ${w}`,
  "date.today.lunar": "{v}",
  "lunar.month": ({ m, leap }) => (leap ? "闰" : "") + ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"][m - 1] + "月",
  "lunar.day": ({ d }) => [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
  ][d - 1] || String(d),
  "lunar.md": ({ month, day }) => month + day,
  "lunar.ymd": ({ ganzhi, md }) => `${ganzhi}年${md}`,
  "lunar.year.option": ({ y, ganzhi, zodiac }) => `${y} ${ganzhi}${zodiac}年`,
  "lunar.ganzhi": ({ stem, branch }) => stem + branch,
  "lunar.stems": ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"],
  "lunar.branches": ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"],
  "lunar.zodiac": ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"],

  "badge.today": "今天",
  "badge.title.left": "距离 {title} 还有 {n} 天",
  "badge.title.ago": "{title} 已过 {n} 天",
  "badge.title.since": "{title} 已经 {n} 天",
  "badge.title.today": "今天：{title}",

  "notif.today": "今天：{title}{ann}",
  "notif.left": "{title}{ann} 还有 {n} 天",
  "notif.ann": "（{v}）",
  "notif.every.title": "{title} 已经 {v}",
  "notif.every.body": "已经 {n} 天 · 从 {date} 至今",
  "notif.test.title": "倒数日 · 测试通知",
  "notif.test.body": "通知工作正常。今天是 {date}",

  "opt.title": "倒数日 · 设置与数据",
  "opt.language": "界面语言",
  "opt.language.desc": "Language of the interface",
  "opt.language.auto": "跟随浏览器",
  "opt.donate": "请开发者喝杯咖啡",
  "opt.donate.desc": "倒数日一个人做，没有广告，也不卖你的数据。每天打开浏览器能看见重要日子，就是它存在的意义。觉得有用的话，请随意打赏一点 USDT——1 枚也特别够意思。功能全部免费，不打赏也能一直用。",
  "opt.donate.hint": "请认准链名再转（BSC / Solana / Tron）。金额随意，谢谢你让这个小工具活得更久。",
  "opt.donate.copy": "复制地址",
  "opt.donate.copied": "地址已复制，谢谢你！",
  "opt.remind": "提醒",
  "opt.remind.time": "每日提醒时间",
  "opt.remind.time.desc": "开启到期提醒的事件会在这个时间发送系统通知",
  "opt.remind.time.saved": "提醒时间已更新为 {v}",
  "opt.notif": "通知权限",
  "opt.notif.checking": "检测中…",
  "opt.notif.granted": "已允许。若仍收不到通知，请检查系统“通知中心”里对 Chrome 的设置。",
  "opt.notif.denied": "已被禁用：请在 Chrome 设置 → 隐私和安全 → 网站设置 → 通知 中允许。",
  "opt.notif.unsupported": "当前浏览器不支持通知 API",
  "opt.notif.test": "发送测试通知",
  "opt.notif.test.sent": "已发送测试通知",
  "opt.notif.test.failed": "发送失败",
  "opt.display": "显示",
  "opt.badge": "图标角标显示天数",
  "opt.badge.desc": "在浏览器工具栏图标上显示置顶（或最近）事件的天数",
  "opt.badge.on": "已开启角标",
  "opt.badge.off": "已关闭角标",
  "opt.includeToday": "已过天数包含当天",
  "opt.includeToday.desc": "开启后起始日算作第 1 天（如出生当天即“已经 1 天”）",
  "opt.saved": "已保存",
  "opt.backup": "数据备份",
  "opt.backup.desc.before": "导出为 JSON 文件即可备份；在另一台电脑或重装浏览器后可再导入恢复。当前共 ",
  "opt.backup.desc.after": " 个事件。",
  "opt.export": "导出为 JSON",
  "opt.export.done": "已导出 {n} 个事件",
  "opt.import": "导入 JSON…",
  "opt.import.merge": "合并导入（相同 ID 的事件会被覆盖）",
  "opt.import.replace": "替换导入（先清空现有数据）",
  "opt.import.confirm": "将清空现有 {a} 个事件，并导入 {b} 个事件。继续？",
  "opt.import.result": "导入完成：{n} 个事件（{mode}），当前共 {total} 个。",
  "opt.import.mode.merge": "合并",
  "opt.import.mode.replace": "替换",
  "opt.import.ok": "导入成功",
  "opt.import.failed": "导入失败",
  "opt.import.failed.msg": "导入失败：{msg}",
  "opt.danger": "危险操作",
  "opt.clear": "清空所有事件",
  "opt.clear.desc": "删除本机保存的全部倒数日数据，建议先导出备份",
  "opt.clear.btn": "清空",
  "opt.clear.empty": "暂无数据",
  "opt.clear.confirm": "确定清空全部 {n} 个事件？此操作不可恢复，建议先导出备份。",
  "opt.clear.done": "已清空",
  "opt.foot": "支持阳历 / 农历（1900–2100）",

  "store.invalid.event": "事件数据无效",
  "store.import.notjson": "文件不是合法的 JSON",
  "store.import.noevents": "未找到事件列表（应包含 events 数组）",
  "store.import.skipped": "第 {i} 条记录无效，已跳过",
};

const en = {
  "app.name": "DayCount",
  "app.tagline": "Settings and backup. All data stays in this browser and is never uploaded anywhere.",

  "common.new": "New",
  "common.save": "Save",
  "common.back": "Back",
  "common.settings": "Settings & backup",
  "common.language": "切换语言 / Language",
  "common.optional": "Optional",

  "home.empty.title": "No events yet",
  "home.empty.desc": "Add birthdays, anniversaries, exams, paydays…\nYou'll see them every time you open the browser.",
  "home.empty.cta": "Add your first event",
  "home.foot": ({ n }) => `${n} saved on this device`,
  "home.donate": "If you like it, buy the developer a coffee →",
  "home.donate.title": "Tip the developer",
  "home.filter.all": "All",
  "home.pinned": "Pinned",

  "edit.new": "New event",
  "edit.edit": "Edit event",
  "edit.title": "Title",
  "edit.title.placeholder": "e.g. Wedding anniversary, Baby born, Exam",
  "edit.date": "Date",
  "edit.calendar.solar": "Solar",
  "edit.calendar.lunar": "Lunar",
  "edit.date.hint.lunar": "Lunar: {v}",
  "edit.date.hint.solar": "Solar: {v}",
  "edit.date.invalid": "This lunar date does not exist",
  "cal.dow": ["S", "M", "T", "W", "T", "F", "S"],
  "cal.month.solar": ({ y, m }) => ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1] + " " + y,
  "cal.month.lunar": "{month} {y}",
  "cal.months": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "cal.year": "{y}",
  "cal.years": "{from} – {to}",
  "cal.prev": "Previous month",
  "cal.next": "Next month",
  "cal.prev.year": "Previous year",
  "cal.next.year": "Next year",
  "cal.prev.years": "Earlier years",
  "cal.next.years": "Later years",
  "cal.today": "Now",
  "cal.today.hint": "Jump to today",
  "cal.pick.month": "Choose month",
  "cal.pick.year": "Choose year",
  "edit.repeat": "Repeat",
  "edit.repeat.every": "Every",
  "edit.display": "Display as",
  "edit.tag": "Tag",
  "edit.tag.custom": "Custom…",
  "edit.tag.custom.placeholder": "Custom tag name",
  "edit.remind": "Reminder",
  "edit.remind.onday": "On the day",
  "edit.remind.before": ({ n, unit }) => (n === 0 ? "On the day" : `${n} ${unit} before`),
  "edit.remind.every": ({ n, unit }) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}`),
  "edit.remind.add": "Add reminder",
  "edit.remind.add.ok": "Add",
  "edit.remind.remove": "Remove",
  "edit.remind.exists": "This reminder already exists",
  "edit.remind.prefix.before": "Before",
  "edit.remind.prefix.every": "Every",
  "edit.remind.default.every": "Past dates default to a yearly reminder. You can change this.",
  "edit.pin": "Pin to top",
  "edit.pin.desc": "Takes the top card and toolbar badge. Only one event can be pinned; turning this on replaces the current pin.",
  "edit.note": "Note",
  "edit.delete": "Delete this event",
  "edit.delete.confirm": "Delete \"{title}\"? This cannot be undone.",
  "edit.untitled": "(Untitled)",
  "edit.invalid": "Invalid date",
  "edit.need.title": "Please enter a title",
  "edit.save.failed": "Save failed: {msg}",
  "edit.saved": "Saved",
  "edit.added": "Added",
  "edit.deleted": "Deleted",

  "preview.countdown": "{title}",
  "preview.past": "{title}",
  "preview.today": "{title} is today",
  "preview.countup": "{title}",

  "repeat.none": "Does not repeat",
  "repeat.day": "Daily",
  "repeat.week": "Weekly",
  "repeat.month": "Monthly",
  "repeat.year": "Yearly",
  "repeat.custom": "Custom…",
  "unit.day": ({ n }) => (n === 1 ? "day" : "days"),
  "unit.week": ({ n }) => (n === 1 ? "week" : "weeks"),
  "unit.month": ({ n }) => (n === 1 ? "month" : "months"),
  "unit.year": ({ n }) => (n === 1 ? "year" : "years"),
  "unit.day.short": "Day",
  "unit.week.short": "Wk",
  "unit.month.short": "Mo",
  "unit.year.short": "Yr",

  "display.days": "Days",
  "display.weeks": "Weeks + days",
  "display.months": "Months + days",
  "display.years": "Years + months + days",

  "cycle.anniversary": ({ n }) => `${ordinal(n)} anniversary`,
  "cycle.nth": ({ n }) => `${ordinal(n)} time`,
  "cycle.since": ({ n }) => `${plural(n, "day", "days")} since`,

  "tag.纪念日": "Anniversary",
  "tag.生活": "Life",
  "tag.工作": "Work",
  "tag.学习": "Study",
  "tag.节日": "Holiday",
  "tag.其他": "Other",

  "days.left.label": "",
  "days.left.unit": ({ n }) => (n === 1 ? "day left" : "days left"),
  "days.left.tail": "left",
  "days.since.label": "",
  "days.since.unit": ({ n }) => (n === 1 ? "day" : "days"),
  "days.since.tail": "",
  "days.ago.label": "",
  "days.ago.unit": ({ n }) => (n === 1 ? "day ago" : "days ago"),
  "days.today.label": "",
  "days.today": "Today",

  "human.years": ({ y, d }) => (d > 0 ? `≈ ${plural(y, "year", "years")} ${d} d` : `≈ ${plural(y, "year", "years")}`),

  "date.lunar.prefix": "Lunar ",
  "date.weekday": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "date.today.line": ({ m, d, w }) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}, ${w}`,
  "date.today.lunar": "Lunar {v}",
  "lunar.month": ({ m, leap }) => (leap ? "Leap M" : "M") + m,
  "lunar.day": ({ d }) => String(d),
  "lunar.md": ({ m, d, leap }) => `${leap ? "Leap " : ""}${m}/${d}`,
  "lunar.ymd": ({ ganzhi, md }) => `${ganzhi} ${md}`,
  "lunar.year.option": ({ y, ganzhi, zodiac }) => `${y} ${ganzhi} (${zodiac})`,
  "lunar.ganzhi": ({ stem, branch }) => `${stem}-${branch}`,
  "lunar.stems": ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"],
  "lunar.branches": ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"],
  "lunar.zodiac": ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"],

  "badge.today": "Now",
  "badge.title.left": ({ title, n }) => `${title}: ${plural(n, "day", "days")} left`,
  "badge.title.ago": ({ title, n }) => `${title}: ${plural(n, "day", "days")} ago`,
  "badge.title.since": ({ title, n }) => `${title}: ${plural(n, "day", "days")} since`,
  "badge.title.today": "Today: {title}",

  "notif.today": "Today: {title}{ann}",
  "notif.left": ({ title, ann, n }) => `${title}${ann}: ${plural(n, "day", "days")} left`,
  "notif.ann": " ({v})",
  "notif.every.title": "{title}: {v}",
  "notif.every.body": ({ n, date }) => `${plural(n, "day", "days")} since ${date}`,
  "notif.test.title": "DayCount · Test notification",
  "notif.test.body": "Notifications are working. Today is {date}",

  "opt.title": "DayCount · Settings",
  "opt.language": "Language",
  "opt.language.desc": "界面语言",
  "opt.language.auto": "Follow browser",
  "opt.donate": "Buy the developer a coffee",
  "opt.donate.desc": "DayCount is a one-person project: no ads, no selling your data. If it helps you remember the days that matter, a USDT tip—even 1—means a lot. Everything stays free either way.",
  "opt.donate.hint": "Send on the matching chain (BSC / Solana / Tron). Any amount helps keep this little tool alive. Thank you.",
  "opt.donate.copy": "Copy address",
  "opt.donate.copied": "Address copied. Thank you!",
  "opt.remind": "Reminders",
  "opt.remind.time": "Daily reminder time",
  "opt.remind.time.desc": "Events with reminders enabled are notified at this time",
  "opt.remind.time.saved": "Reminder time set to {v}",
  "opt.notif": "Notification permission",
  "opt.notif.checking": "Checking…",
  "opt.notif.granted": "Granted. If you still don't see notifications, check the system notification settings for Chrome.",
  "opt.notif.denied": "Blocked: allow it in Chrome Settings → Privacy and security → Site settings → Notifications.",
  "opt.notif.unsupported": "Notifications API is not available",
  "opt.notif.test": "Send test notification",
  "opt.notif.test.sent": "Test notification sent",
  "opt.notif.test.failed": "Failed to send",
  "opt.display": "Display",
  "opt.badge": "Show days on icon badge",
  "opt.badge.desc": "Show the pinned (or nearest) event's days on the toolbar icon",
  "opt.badge.on": "Badge enabled",
  "opt.badge.off": "Badge disabled",
  "opt.includeToday": "Days-since count includes the start day",
  "opt.includeToday.desc": "When on, the start date counts as day 1",
  "opt.saved": "Saved",
  "opt.backup": "Backup",
  "opt.backup.desc.before": "Export a JSON file to back up; import it on another computer or after reinstalling. Currently ",
  "opt.backup.desc.after": " events.",
  "opt.export": "Export JSON",
  "opt.export.done": "Exported {n} events",
  "opt.import": "Import JSON…",
  "opt.import.merge": "Merge (events with the same ID are overwritten)",
  "opt.import.replace": "Replace (clear existing data first)",
  "opt.import.confirm": "This will remove {a} existing events and import {b}. Continue?",
  "opt.import.result": "Imported {n} events ({mode}); {total} in total.",
  "opt.import.mode.merge": "merge",
  "opt.import.mode.replace": "replace",
  "opt.import.ok": "Import complete",
  "opt.import.failed": "Import failed",
  "opt.import.failed.msg": "Import failed: {msg}",
  "opt.danger": "Danger zone",
  "opt.clear": "Delete all events",
  "opt.clear.desc": "Removes all DayCount data from this browser. Export a backup first.",
  "opt.clear.btn": "Clear",
  "opt.clear.empty": "Nothing to clear",
  "opt.clear.confirm": "Delete all {n} events? This cannot be undone.",
  "opt.clear.done": "Cleared",
  "opt.foot": "Solar & lunar calendars (1900–2100)",

  "store.invalid.event": "Invalid event data",
  "store.import.notjson": "File is not valid JSON",
  "store.import.noevents": "No event list found (expected an \"events\" array)",
  "store.import.skipped": "Record #{i} is invalid and was skipped",
};

const DICTS = { zh, en };
let current = "zh";

export function detectLang() {
  const nav = (globalThis.navigator && navigator.language) || "zh";
  return /^zh/i.test(nav) ? "zh" : "en";
}

export function resolveLang(setting) {
  return LANGS.includes(setting) ? setting : detectLang();
}

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : "zh";
  if (globalThis.document) document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
  return current;
}

export function getLang() {
  return current;
}

/** 读取设置中的语言并应用；返回当前语言。 */
export async function initI18n(loadSettings) {
  let setting = "auto";
  try {
    const s = await loadSettings();
    setting = s.language || "auto";
  } catch {
    // 无法读取设置时跟随浏览器
  }
  return setLang(resolveLang(setting));
}

export function t(key, params = {}) {
  const dict = DICTS[current] || zh;
  let v = key in dict ? dict[key] : zh[key];
  if (v === undefined) return key;
  if (typeof v === "function") return v(params);
  if (Array.isArray(v)) return v;
  return v.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? "" : String(params[k])));
}

/** 应用 data-i18n / data-i18n-placeholder / data-i18n-title 属性。 */
export function applyDom(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  if (root === document) {
    const titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) document.title = t(titleEl.dataset.i18n);
  }
}

/** 标签显示名：内置标签翻译，自定义标签原样返回。 */
export function tagLabel(name) {
  const key = "tag." + name;
  const dict = DICTS[current] || zh;
  return key in dict ? dict[key] : name;
}
