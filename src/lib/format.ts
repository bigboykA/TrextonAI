export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainder]
      .map((part) => part.toString().padStart(2, "0"))
      .join(":");
  }

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function formatRelativeDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently created";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear()
      ? undefined
      : "numeric",
  }).format(date);
}

export function truncateIdentifier(value: string): string {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KiB", "MiB", "GiB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
