import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}


export function hasModuleAccess(currentTab, userPermissions) {
  if (!userPermissions || !Array.isArray(userPermissions.modules)) return false;

  return userPermissions.modules.some(
    (m) => m.toLowerCase() === currentTab.toLowerCase()
  );
}

export const parseDurationToYears = (duration) => {
  const match = duration.match(/(\d+)\s*(year|years|yr|y)/i);
  if (match) return parseInt(match[1]);
  return 0;
};

export const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const formatTime = (isoString) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const extractId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return (val._id || val.id || "").toString();
  return String(val);
};

export const resolveFileUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
};

