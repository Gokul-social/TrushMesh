import type { ApiEnvelope, AgentStatus, JobStatus } from "../types";

export const JWT_STORAGE_KEY = "trustmesh.jwt";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function getJwtFromLocalStorage() {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setJwtInLocalStorage(token: string) {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(JWT_STORAGE_KEY, token);
  } catch {
    // Ignore storage failures so auth helpers never crash UI flows.
  }
}

export function clearJwtFromLocalStorage() {
  const storage = getLocalStorageSafe();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(JWT_STORAGE_KEY);
  } catch {
    // Ignore storage failures so auth helpers never crash UI flows.
  }
}

export function unwrapEnvelope<T>(payload: ApiEnvelope<T>): T {
  if (payload.error) {
    throw new Error(payload.error.message);
  }
  if (payload.data === null) {
    throw new Error("Empty API response");
  }
  return payload.data;
}

export function truncateMiddle(value: string, start = 8, end = 4) {
  if (value.length <= start + end + 1) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return "No recent actions";
  }

  const then = new Date(value).getTime();
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatStatusLabel(status: AgentStatus | JobStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function statusColor(status: AgentStatus | JobStatus) {
  switch (status) {
    case "ACTIVE":
      return "rgb(var(--tm-color-status-active))";
    case "WARNING":
      return "rgb(var(--tm-color-status-warning))";
    case "REVOKED":
      return "rgb(var(--tm-color-status-revoked))";
    case "COMPLETE":
      return "rgb(var(--tm-color-status-complete))";
    case "PENDING":
      return "rgb(var(--tm-color-text-tertiary))";
    default:
      return "rgb(var(--tm-color-text-secondary))";
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function hashToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return hashToHex(new Uint8Array(digest));
}

export function randomHex(bytes = 32) {
  const array = new Uint8Array(bytes);
  window.crypto.getRandomValues(array);
  return hashToHex(array);
}

export function safeNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}
