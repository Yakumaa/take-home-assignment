/**
 * components/StatusBadge.jsx
 * Maps candidate status → appropriate badge color.
 */
import { Badge } from "@/components/ui/primitives";

const STATUS_MAP = {
  new: "info",
  reviewed: "warning",
  hired: "success",
  rejected: "destructive",
  archived: "secondary",
};

export function StatusBadge({ status }) {
  const variant = STATUS_MAP[status] ?? "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

/**
 * components/Spinner.jsx
 * Inline SVG spinner — no external icon library needed for this atom.
 */
export function Spinner({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}