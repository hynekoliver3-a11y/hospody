"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { createCompany } from "./actions";

export function OnboardingForm() {
  const t = useT();
  const [state, action] = useActionState(createCompany, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("onboarding.companyName")} name="companyName" defaultValue={state?.values?.companyName} required autoComplete="organization" />
      <Field
        label={`${t("onboarding.ico")} (${t("common.optional")})`}
        name="ico"
        defaultValue={state?.values?.ico}
        inputMode="numeric"
        maxLength={8}
        pattern="\d{8}"
      />
      <Field label={`${t("onboarding.companyAddress")} (${t("common.optional")})`} name="companyAddress" defaultValue={state?.values?.companyAddress} />
      <hr className="my-2 border-line" />
      <Field label={t("onboarding.locationName")} name="locationName" defaultValue={state?.values?.locationName} required />
      <Field label={`${t("onboarding.locationAddress")} (${t("common.optional")})`} name="locationAddress" defaultValue={state?.values?.locationAddress} />
      <FormMessage state={state} />
      <SubmitButton>{t("onboarding.submit")}</SubmitButton>
    </form>
  );
}
