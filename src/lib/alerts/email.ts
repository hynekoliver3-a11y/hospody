import type { Translator } from "@/i18n/translate";

export interface AlertEmailData {
  locationName: string;
  overdue: { title: string; slotLabel: string; due: string }[];
  deviations: { title: string; value: string; corrective: string; who: string; when: string }[];
  dashboardUrl: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Jednoduchý HTML e-mail (inline styly kvůli poštovním klientům) + textová verze. */
export function renderAlertEmail(t: Translator, d: AlertEmailData) {
  const subject = t("email.subject", { location: d.locationName });
  const li = "padding:8px 12px;margin:0 0 6px;border-radius:6px;list-style:none;";
  const html = `<!doctype html><html lang="cs"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f1f5f9;padding:24px">
<div style="max-width:600px;margin:0 auto;background:#fff;border:2px solid #cbd5e1;border-radius:12px;padding:24px">
<h1 style="font-size:20px;color:#0b3b75;margin:0 0 12px">${esc(subject)}</h1>
<p>${esc(t("email.intro", { location: d.locationName }))}</p>
${
  d.overdue.length
    ? `<h2 style="font-size:16px;margin:20px 0 8px">⚠ ${esc(t("email.overdueTitle"))}</h2><ul style="padding:0;margin:0">${d.overdue
        .map(
          (o) =>
            `<li style="${li}background:#fef3c7;color:#92400e"><b>${esc(o.title)}</b>${o.slotLabel ? ` (${esc(o.slotLabel)})` : ""} – ${esc(t("email.dueAt", { time: o.due }))}</li>`,
        )
        .join("")}</ul>`
    : ""
}
${
  d.deviations.length
    ? `<h2 style="font-size:16px;margin:20px 0 8px">⛔ ${esc(t("email.deviationTitle"))}</h2><ul style="padding:0;margin:0">${d.deviations
        .map(
          (x) =>
            `<li style="${li}background:#fee2e2;color:#b91c1c"><b>${esc(x.title)}: ${esc(x.value)}</b> · ${esc(x.when)} · ${esc(x.who)}<br><span style="color:#0f172a">${esc(x.corrective)}</span></li>`,
        )
        .join("")}</ul>`
    : ""
}
<p style="margin-top:24px"><a href="${esc(d.dashboardUrl)}" style="background:#0b3b75;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(t("email.open"))}</a></p>
<p style="color:#475569;font-size:12px;margin-top:24px">${esc(t("email.footer"))}</p>
</div></body></html>`;

  const text = [
    subject,
    "",
    t("email.intro", { location: d.locationName }),
    ...(d.overdue.length ? ["", t("email.overdueTitle") + ":", ...d.overdue.map((o) => `- ${o.title}${o.slotLabel ? ` (${o.slotLabel})` : ""}, ${t("email.dueAt", { time: o.due })}`)] : []),
    ...(d.deviations.length
      ? ["", t("email.deviationTitle") + ":", ...d.deviations.map((x) => `- ${x.title}: ${x.value}, ${x.when}, ${x.who} – ${x.corrective}`)]
      : []),
    "",
    d.dashboardUrl,
  ].join("\n");

  return { subject, html, text };
}

/** Odeslání přes Resend REST API (bez SDK). */
export async function sendEmail(to: string[], mail: { subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, error: "RESEND_API_KEY není nastaven" };
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL ?? "HACCP deník <onboarding@resend.dev>",
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) return { ok: false as const, error: `Resend ${res.status}: ${await res.text()}` };
  return { ok: true as const };
}
