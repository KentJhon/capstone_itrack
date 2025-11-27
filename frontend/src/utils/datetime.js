const BASE_OPTIONS = {
  timeZone: "Asia/Manila",
};

export function formatDateTime(value, opts = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
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
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    ...BASE_OPTIONS,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(date);
}
