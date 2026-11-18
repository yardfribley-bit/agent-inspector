import { ReactNode } from "react";

interface InfoCardProps {
  title: string;
  icon?: string;
  children: ReactNode;
  highlight?: boolean;
}

export function InfoCard({ title, icon, children, highlight = false }: InfoCardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ${
        highlight
          ? "border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-950/20"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-xl" aria-hidden>{icon}</span>}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  value?: string | null | undefined;
  mono?: boolean;
}

export function FieldRow({ label, value, mono = false }: FieldRowProps) {
  const display = value === undefined || value === null || value === ""
    ? "N/A"
    : value;

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span
        className={`text-sm text-slate-800 dark:text-slate-100 ${
          mono ? "font-mono" : ""
        } ${
          display === "N/A" ? "text-slate-300 dark:text-slate-600" : ""
        }`}
      >
        {display}
      </span>
    </div>
  );
}

interface BadgeProps {
  label: string;
  color: "green" | "amber" | "red" | "purple" | "blue" | "gray";
  size?: "sm" | "md";
}

export function Badge({ label, color, size = "sm" }: BadgeProps) {
  const colors: Record<string, string> = {
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700",
    gray: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
  };

  const sizes: Record<string, string> = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${colors[color]} ${sizes[size]}`}
    >
      {label}
    </span>
  );
}
