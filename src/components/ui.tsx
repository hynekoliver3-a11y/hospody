"use client";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";

type Variant = "primary" | "secondary" | "danger" | "ok";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark border-brand",
  secondary: "bg-white text-ink hover:bg-page border-ink",
  danger: "bg-danger text-white hover:opacity-90 border-danger",
  ok: "bg-ok text-white hover:opacity-90 border-ok",
};

export function buttonClass(variant: Variant = "primary", size: "lg" | "md" = "lg") {
  const sizing = size === "lg" ? "min-h-14 px-6 text-lg" : "min-h-11 px-4 text-base";
  return `inline-flex items-center justify-center gap-2 rounded-lg border-2 font-semibold ${sizing} ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`;
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "lg",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: "lg" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${buttonClass(variant, size)} ${className}`}>
      {pending ? t("common.loading") : children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "lg",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  hint,
  autoComplete,
  inputMode,
  maxLength,
  pattern,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  hint?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        pattern={pattern}
        placeholder={placeholder}
        className="min-h-13 rounded-lg border-2 border-line bg-white px-4 text-lg focus:border-brand"
      />
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}

/** Zobrazí chybu/úspěch ze server action (hodnoty jsou překladové klíče). */
export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  const t = useT();
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg border-2 border-danger bg-danger-bg px-4 py-3 font-semibold text-danger">
        {t(state.error)}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="rounded-lg border-2 border-ok bg-ok-bg px-4 py-3 font-semibold text-ok">
        {t(state.ok)}
      </p>
    );
  }
  return null;
}
