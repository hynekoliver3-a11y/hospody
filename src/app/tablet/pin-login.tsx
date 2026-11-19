"use client";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { pinLogin } from "./actions";

type Person = { id: string; name: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

export function PinLogin({ employees }: { employees: Person[] }) {
  const t = useT();
  const [selected, setSelected] = useState<Person | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function press(key: (typeof KEYS)[number]) {
    if (pending || !selected) return;
    setError(null);
    if (key === "clear") return setPin("");
    if (key === "back") return setPin((p) => p.slice(0, -1));
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      startTransition(async () => {
        const result = await pinLogin(selected.id, next);
        // úspěch = redirect; sem se dostaneme jen při chybě
        if (result?.error) {
          setError(result.error);
          setPin("");
        }
      });
    }
  }

  if (!selected) {
    if (!employees.length) return <p className="text-lg text-muted">{t("tablet.noEmployees")}</p>;
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("tablet.whoAreYou")}</h1>
        <ul className="grid gap-3 sm:grid-cols-2">
          {employees.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelected(e)}
                className="flex min-h-20 w-full items-center rounded-xl border-2 border-ink bg-white px-6 text-left text-xl font-bold hover:bg-page active:bg-line"
              >
                {e.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
      <h1 className="text-2xl font-bold">{t("tablet.hello", { name: selected.name })}</h1>
      <p className="text-lg">{t("tablet.enterPin")}</p>
      <div className="flex gap-4" aria-live="polite" aria-label={`${pin.length} / 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-6 w-6 rounded-full border-2 border-ink ${i < pin.length ? "bg-ink" : "bg-white"}`}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="w-full rounded-lg border-2 border-danger bg-danger-bg px-4 py-3 text-center font-semibold text-danger">
          {t(error)}
        </p>
      )}
      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={pending}
            onClick={() => press(key)}
            className={`min-h-20 rounded-xl border-2 border-ink text-3xl font-bold active:bg-line disabled:opacity-50 ${
              key === "clear" || key === "back" ? "bg-page text-lg" : "bg-white"
            }`}
          >
            {key === "clear" ? t("tablet.clear") : key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setPin("");
          setError(null);
        }}
        className="min-h-14 w-full rounded-lg border-2 border-ink bg-white text-lg font-semibold"
      >
        {t("tablet.otherPerson")}
      </button>
    </div>
  );
}
