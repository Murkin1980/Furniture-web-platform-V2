export function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function okResult(body, status = 200) {
  return { ok: true, status, body: { success: true, ...body } };
}

export function errorResult(status, error, message) {
  return { ok: false, status, body: { success: false, error, message } };
}

export function normalizePlainTextPreview(value, maxLength = 200) {
  const safeLength = Math.max(0, Number(maxLength) || 0);
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, safeLength);
}

export function withUpdatedAt(setClauses) {
  const clauses = Array.isArray(setClauses) ? [...setClauses] : [];
  if (!clauses.includes("updated_at = CURRENT_TIMESTAMP")) {
    clauses.push("updated_at = CURRENT_TIMESTAMP");
  }
  return clauses;
}
