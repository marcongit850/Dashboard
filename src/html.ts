export function escapeHtml(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function redactSecrets(value: string): string {
  return value
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/\b(?:bearer|token)\s+\S+/gi, "[redacted]");
}

export function clip(value: string, max = 280): string {
  const trimmed = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

export function safeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}
