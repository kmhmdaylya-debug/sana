const confidentialKey = /password|token|secret|credential|national.?id|sheba|iban|account.?number|card.?number|salary|wage|amount|benefit|deduction|first.?name|last.?name|full.?name|father|birth|mobile|phone|email|address|emergency|note|reason|description|body|payload|config.?json|^value$/i;

/** Keep audit structure and identifiers, never credentials or HR payload values. */
export function stringifyAudit(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value, (key, item) => confidentialKey.test(key) ? '[REDACTED]' : typeof item === 'bigint' ? item.toString() : item);
  } catch {
    return '[UNSERIALIZABLE]';
  }
}

export function sanitizeStoredAudit(value: string | null): string | null {
  if (!value) return null;
  try { return stringifyAudit(JSON.parse(value)); } catch { return '[REDACTED]'; }
}
