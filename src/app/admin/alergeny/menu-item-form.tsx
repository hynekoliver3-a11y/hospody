"use client";
import { startTransition, useActionState } from "react";
import { buttonClass, FormMessage } from "@/components/ui";
import { useT } from "@/i18n/client";
import { ALLERGEN_IDS, type MenuItem } from "@/lib/allergens";
import { saveMenuItem } from "./actions";

const input = "min-h-12 rounded-lg border-2 border-line bg-white px-3 text-lg";

export function MenuItemForm({ item, locationId }: { item?: MenuItem; locationId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveMenuItem, undefined);
  const v = state?.values;
  return (
    // onSubmit místo <form action>: po chybě se nesmí resetovat zaškrtnuté alergeny
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="locationId" value={locationId} />
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-semibold">{t("allergensAdmin.name")}</span>
        <input name="name" required defaultValue={v?.name ?? item?.name} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t("allergensAdmin.category")}</span>
        <input name="category" defaultValue={v?.category ?? item?.category ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t("allergensAdmin.price")}</span>
        <input name="price" inputMode="decimal" defaultValue={v?.price ?? item?.price ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-semibold">{t("allergensAdmin.description")}</span>
        <input name="description" defaultValue={v?.description ?? item?.description ?? ""} className={input} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 font-semibold">{t("allergensAdmin.allergens")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALLERGEN_IDS.map((id) => (
            <label
              key={id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-line bg-white px-3 has-[:checked]:border-brand has-[:checked]:bg-brand/10"
            >
              <input
                type="checkbox"
                name="allergens"
                value={id}
                defaultChecked={item?.allergens.includes(id)}
                className="h-6 w-6 shrink-0 accent-[var(--color-brand)]"
              />
              <span>
                <b className="tabular-nums">{id}</b> · {t(`allergens.${id}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? t("common.loading") : item ? t("common.save") : t("allergensAdmin.add")}
        </button>
      </div>
    </form>
  );
}
