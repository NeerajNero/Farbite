// Tiny shared admin UI helpers (plain Tailwind, no component library).
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm disabled:bg-neutral-100 disabled:text-neutral-500";
export const buttonClass =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";
export const secondaryButtonClass =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50";
export const dangerButtonClass =
  "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function ErrorBox({
  message,
  details,
}: {
  message: string;
  details?: { path: string; message: string }[];
}) {
  return (
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{message}</p>
      {details && details.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {details.map((d, i) => (
            <li key={i}>
              {d.path ? `${d.path}: ` : ""}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-semibold">{title}</h1>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export const thClass =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500";
export const tdClass = "px-3 py-2 align-top";
