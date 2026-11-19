// Sdílené třídy tlačítek – použitelné ze server i client komponent.
export type Variant = "primary" | "secondary" | "danger" | "ok";

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

