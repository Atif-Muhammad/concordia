export const INPUT_LIMITS = {
  name: 100,
  title: 100,
  label: 100,
  email: 100,
  phone: 20,
  cnic: 15,
  code: 50,
  roll: 50,
  password: 72,
  shortText: 255,
  longText: 500,
  search: 100,
};

export const IMAGE_UPLOAD_RULES = {
  maxBytes: 10 * 1024 * 1024,
  accept: ".png,.jpg,.jpeg",
  mimeTypes: ["image/png", "image/jpeg"],
  extensions: [".png", ".jpg", ".jpeg"],
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const pkMobilePattern = /^(?:\+92|0092|92|0)?3\d{9}$/;
const pkLandlinePattern = /^(?:\+92|0092|92|0)?[1-9]\d{7,10}$/;

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function formatCnic(value) {
  const digits = digitsOnly(value).slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function normalizePkPhone(value) {
  return String(value || "").replace(/[\s()-]/g, "");
}

export function isValidEmail(value) {
  const text = String(value || "").trim();
  return !text || (text.length <= INPUT_LIMITS.email && emailPattern.test(text));
}

export function isValidPkPhone(value) {
  const normalized = normalizePkPhone(value);
  if (!normalized) return true;
  const digits = normalized.replace(/^\+/, "");
  return digits.length <= INPUT_LIMITS.phone && (pkMobilePattern.test(normalized) || pkLandlinePattern.test(normalized));
}

export function isValidCnic(value) {
  const digits = digitsOnly(value);
  return !digits || digits.length === 13;
}

export function validateMaxLength(value, max, label = "Input") {
  if (String(value || "").length > max) {
    return `${label} must be ${max} characters or fewer.`;
  }
  return "";
}

export function validateRequired(value, label = "This field") {
  return String(value ?? "").trim() ? "" : `${label} is required.`;
}

export function validateNonNegativeNumber(value, label = "Value") {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${label} must be a valid number.`;
  if (parsed < 0) return `${label} cannot be negative.`;
  return "";
}

export function validateEmail(value) {
  return isValidEmail(value) ? "" : "Email must be a valid email address.";
}

export function validatePkPhone(value) {
  return isValidPkPhone(value) ? "" : "Phone must be a valid Pakistan number, e.g. 0300-1234567 or 091-5619915.";
}

export function validateCnic(value) {
  return isValidCnic(value) ? "" : "CNIC must be 13 digits, e.g. 12345-1234567-1.";
}

export function validateImageFile(file) {
  if (!file) return "";
  const lowerName = String(file.name || "").toLowerCase();
  const hasAllowedExtension = IMAGE_UPLOAD_RULES.extensions.some((extension) => lowerName.endsWith(extension));
  const hasAllowedMime = IMAGE_UPLOAD_RULES.mimeTypes.includes(file.type);
  if (!hasAllowedExtension || !hasAllowedMime) {
    return "Image must be PNG, JPG, or JPEG and 10 MB or smaller.";
  }
  if (file.size > IMAGE_UPLOAD_RULES.maxBytes) {
    return "Image must be PNG, JPG, or JPEG and 10 MB or smaller.";
  }
  return "";
}

export function getDefaultMaxLength(props = {}) {
  const haystack = `${props.name || ""} ${props.id || ""} ${props.placeholder || ""} ${props.type || ""}`.toLowerCase();
  if (props.maxLength) return props.maxLength;
  if (props.type === "email" || haystack.includes("email")) return INPUT_LIMITS.email;
  if (props.type === "password" || haystack.includes("password")) return INPUT_LIMITS.password;
  if (haystack.includes("cnic") || haystack.includes("form-b")) return INPUT_LIMITS.cnic;
  if (haystack.includes("phone") || haystack.includes("contact")) return INPUT_LIMITS.phone;
  if (haystack.includes("roll") || haystack.includes("code") || haystack.includes("reference")) return INPUT_LIMITS.code;
  if (haystack.includes("search")) return INPUT_LIMITS.search;
  if (haystack.includes("address") || haystack.includes("remark") || haystack.includes("description")) return INPUT_LIMITS.longText;
  return undefined;
}

export function firstError(...messages) {
  return messages.find(Boolean) || "";
}
