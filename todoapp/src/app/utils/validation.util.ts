export function isEmptyString(value?: string | null): boolean {
  return !value || (typeof value === 'string' && value.trim().length === 0);
}

export function trimString(value?: string | null): string {
  return value ? String(value).trim() : '';
}
