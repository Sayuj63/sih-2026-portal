"use client";
import { ReactNode, forwardRef, InputHTMLAttributes, ButtonHTMLAttributes, SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("p-5 sm:p-6", className)}>{children}</div>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("border-b border-slate-200 px-5 py-4 sm:px-6", className)}>{children}</div>
  );
}

export function SectionTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...rest}
      className={clsx(
        "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100",
        className,
      )}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      {...rest}
      className={clsx(
        "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        className,
      )}
    >
      {children}
    </select>
  );
});

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variantClasses: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-300",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus:ring-slate-200",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-300",
  ghost: "text-slate-700 hover:bg-slate-100",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }>(
  function Button({ className, variant = "primary", loading, disabled, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        {...rest}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed",
          variantClasses[variant],
          className,
        )}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  },
);

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const map = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-indigo-100 text-indigo-800",
  } as const;
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", map[tone])}>{children}</span>;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | "success"; title?: ReactNode; children?: ReactNode }) {
  const map = {
    info: "border-indigo-200 bg-indigo-50 text-indigo-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;
  return (
    <div className={clsx("rounded-md border p-3 text-sm", map[tone])}>
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-800">{label}</div>
      {children}
      {hint && !error && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </label>
  );
}
