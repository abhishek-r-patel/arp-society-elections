// Shared input-format rules for voter registration (self-service and admin-
// assisted) — flat numbers follow this society's fixed wing/floor scheme, so
// invalid values are caught client-side before they ever reach the API.
export const FLAT_NO_PATTERN = /^[A-E]-(001|002|101|102|201|202|301|302|401|402)$/;
export const FLAT_NO_HINT = 'Format: wing A-E, then 001, 002, 101, 102, 201, 202, 301, 302, 401, or 402 (e.g. C-201)';

export const PHONE_PATTERN = /^\d{10}$/;
export const PHONE_HINT = '10-digit phone number, no spaces or country code';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidFlatNo(value: string): boolean {
  return FLAT_NO_PATTERN.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
