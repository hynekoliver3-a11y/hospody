"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { register } from "../actions";

export function RegisterForm() {
  const t = useT();
  const [state, action] = useActionState(register, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("auth.name")} name="name" defaultValue={state?.values?.name} autoComplete="name" required />
      <Field label={t("auth.email")} name="email" type="email" defaultValue={state?.values?.email} autoComplete="email" required />
      <Field
        label={t("auth.password")}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t("auth.passwordHint")}
        required
      />
      <FormMessage state={state} />
      <SubmitButton>{t("auth.registerSubmit")}</SubmitButton>
    </form>
  );
}
