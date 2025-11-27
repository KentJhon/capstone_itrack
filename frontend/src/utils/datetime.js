const BASE_OPTIONS = {
  timeZone: "Asia/Manila",
};

function parseUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  if (typeof value === "string") {
    // If the string has no timezone info, treat it as UTC to avoid off-by-one-day shifts.
    const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
    const iso = hasZone ? value : `${value}Z`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function formatDateTime(value, opts = {}) {
  const date = parseUtc(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    ...BASE_OPTIONS,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...opts,
  }).format(date);
}

export function formatDate(value, opts = {}) {
  const date = parseUtc(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-PH", {
    ...BASE_OPTIONS,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(date);
}
