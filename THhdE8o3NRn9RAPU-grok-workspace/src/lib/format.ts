const nyDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const nyTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const nyClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const nyWeekday = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
});

const nyParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

export function money(n: number, opts?: { sign?: boolean; digits?: number }) {
  const digits = opts?.digits ?? (Math.abs(n) >= 1000 ? 0 : 2);
  const abs = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (opts?.sign) {
    if (n > 0) return `+${abs}`;
    if (n < 0) return `−${abs}`;
    return abs;
  }
  return n < 0 ? `−${abs}` : abs;
}

export function compactMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  return money(n);
}

export function pct(n: number, digits = 1) {
  const body = `${Math.abs(n).toFixed(digits)}%`;
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

export function signed(n: number, digits = 0) {
  const body = Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

export function formatNyDate(iso: string | Date) {
  return nyDate.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatNyTime(iso: string | Date) {
  return nyTime.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatNyStamp(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${nyDate.format(d)} · ${nyTime.format(d)} ET`;
}

export function formatNyClock(d = new Date()) {
  return `${nyClock.format(d)} ET`;
}

export function nyWeekdayName(d = new Date()) {
  return nyWeekday.format(d);
}

export function isNySessionOpen(d = new Date()) {
  const parts = nyParts.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function nySessionLabel(open: boolean) {
  return open ? "Open" : "Closed";
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = dayKey(new Date().toISOString());
  const key = dayKey(iso);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (key === today) return "Today";
  if (key === dayKey(yest.toISOString())) return "Yesterday";
  return nyDate.format(d);
}

export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}
