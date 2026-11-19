"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { addEmployee, changeEmployeePin, createLocation, updateLocation } from "./actions";

type LocationValues = { id: string; name: string; address: string | null; alert_email: string | null };

export function LocationForm({ location }: { location?: LocationValues }) {
  const t = useT();
  const [state, action] = useActionState(location ? updateLocation : createLocation, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {location && <input type="hidden" name="id" value={location.id} />}
      <Field label={t("admin.locations.name")} name="name" defaultValue={state?.values?.name ?? location?.name} required />
      <Field
        label={`${t("admin.locations.address")} (${t("common.optional")})`}
        name="address"
        defaultValue={state?.values?.address ?? location?.address}
      />
      <Field
        label={`${t("admin.locations.alertEmail")} (${t("common.optional")})`}
        name="alertEmail"
        type="email"
        defaultValue={state?.values?.alertEmail ?? location?.alert_email}
        hint={t("admin.locations.alertEmailHint")}
      />
      <FormMessage state={state} />
      <SubmitButton>{location ? t("common.save") : t("admin.locations.create")}</SubmitButton>
    </form>
  );
}

export function AddEmployeeForm({ locationId }: { locationId: string }) {
  const t = useT();
  const [state, action] = useActionState(addEmployee, undefined);
  return (
    <form
      action={action}
      className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
    >
      <input type="hidden" name="locationId" value={locationId} />
      <Field label={t("admin.employees.name")} name="name" defaultValue={state?.values?.name} required />
      <Field
        label={t("admin.employees.pin")}
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        pattern="\d{4}"
        required
      />
      <SubmitButton>{t("admin.employees.add")}</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ChangePinForm({ employeeId }: { employeeId: string }) {
  const t = useT();
  const [state, action] = useActionState(changeEmployeePin, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        pattern="\d{4}"
        required
        aria-label={t("admin.employees.newPin")}
        placeholder={t("admin.employees.newPin")}
        className="min-h-11 w-32 rounded-lg border-2 border-line px-3"
      />
      <SubmitButton size="md" variant="secondary">
        {t("admin.employees.changePin")}
      </SubmitButton>
      {(state?.error || state?.ok) && (
        <span className={state.error ? "font-semibold text-danger" : "font-semibold text-ok"}>
          {t(state.error ?? state.ok ?? "")}
        </span>
      )}
    </form>
  );
}
