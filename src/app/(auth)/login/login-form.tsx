"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { login } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const t = useT();
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label={t("auth.email")} name="email" type="email" defaultValue={state?.values?.email} autoComplete="email" required />
      <Field label={t("auth.password")} name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <SubmitButton>{t("auth.loginSubmit")}</SubmitButton>
    </form>
  );
}
