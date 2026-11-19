"use client";
import { startTransition, useActionState, useState } from "react";
import { buttonClass, FormMessage } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { TaskCategory, TaskFrequency, TaskTemplate } from "@/lib/types";
import { saveTemplate } from "./actions";

const CATEGORIES: TaskCategory[] = ["temperature", "cleaning", "goods_receipt", "expiry", "other"];
const FREQUENCIES: TaskFrequency[] = ["daily", "morning_evening", "weekly"];
const input = "min-h-12 rounded-lg border-2 border-line bg-white px-3 text-lg";

export function TemplateForm({ template, locationId }: { template?: TaskTemplate; locationId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveTemplate, undefined);
  const v = state?.values;
  const [category, setCategory] = useState<TaskCategory>((v?.category as TaskCategory) ?? template?.category ?? "cleaning");
  const [frequency, setFrequency] = useState<TaskFrequency>(
    (v?.frequency as TaskFrequency) ?? template?.frequency ?? "daily",
  );
  // Pozn.: odesíláme přes onSubmit (ne <form action>), aby React po chybě formulář neresetoval –
  // reset vrací <select> v DOM na první možnost a rozchází se se stavem (podmíněná pole).
  const hasLimits = category === "temperature" || category === "goods_receipt";
  const f = (k: string) => t(`admin.templates.fields.${k}`);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="locationId" value={locationId} />

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-semibold">{f("title")}</span>
        <input name="title" required defaultValue={v?.title ?? template?.title} className={input} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{f("category")}</span>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={input}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{f("frequency")}</span>
        <select
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as TaskFrequency)}
          className={input}
        >
          {FREQUENCIES.map((fr) => (
            <option key={fr} value={fr}>
              {t(`admin.templates.frequency.${fr}`)}
            </option>
          ))}
        </select>
      </label>

      {frequency === "weekly" && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{f("weekday")}</span>
          <select name="weekday" defaultValue={v?.weekday ?? template?.weekday ?? 1} className={input}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {t(`admin.templates.weekdays.${d}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{frequency === "morning_evening" ? f("morningDue") : f("dueTime")}</span>
        <input
          type="time"
          name="due_time"
          required
          defaultValue={(v?.due_time ?? template?.due_time ?? "12:00").slice(0, 5)}
          className={input}
        />
      </label>

      {frequency === "morning_evening" && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{f("eveningDue")}</span>
          <input
            type="time"
            name="evening_due_time"
            required
            defaultValue={(v?.evening_due_time ?? template?.evening_due_time ?? "21:00").slice(0, 5)}
            className={input}
          />
        </label>
      )}

      {hasLimits && (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{f("min")}</span>
            <input name="min_value" inputMode="decimal" defaultValue={v?.min_value ?? template?.min_value ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{f("max")}</span>
            <input name="max_value" inputMode="decimal" defaultValue={v?.max_value ?? template?.max_value ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{f("unit")}</span>
            <input name="unit" defaultValue={v?.unit ?? template?.unit ?? "°C"} className={input} />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-semibold">{f("instructions")}</span>
        <textarea
          name="instructions"
          rows={2}
          defaultValue={v?.instructions ?? template?.instructions ?? ""}
          className="rounded-lg border-2 border-line px-3 py-2 text-lg"
        />
      </label>

      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="photo_required" defaultChecked={template?.photo_required} className="h-6 w-6" />
        <span className="font-semibold">{f("photoRequired")}</span>
      </label>
      <label className="flex min-h-12 items-center gap-3">
        <input
          type="checkbox"
          name="repeatable"
          defaultChecked={template?.repeatable ?? category === "goods_receipt"}
          className="h-6 w-6"
        />
        <span className="font-semibold">{f("repeatable")}</span>
      </label>

      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? t("common.loading") : template ? t("common.save") : t("admin.templates.create")}
        </button>
      </div>
    </form>
  );
}
