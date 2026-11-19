"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { formatLimits, outOfLimits, parseDecimal } from "@/lib/tasks/deviation";
import { enqueue } from "@/lib/offline/queue";
import { compressImage, submitRecord, type RecordInput, type SubmitContext } from "@/lib/tasks/submit";
import { SyncBanner, useOfflineQueue } from "./sync";
import type { ChecklistItem, DoneRecord } from "./types";

type Status = "done" | "pending" | "overdue";

export function Checklist({ items, tz, ctx }: { items: ChecklistItem[]; tz: string; ctx: SubmitContext }) {
  const t = useT();
  const [added, setAdded] = useState<Record<string, DoneRecord[]>>({});
  const [now, setNow] = useState(() => Date.now());
  const { online, queued, syncing } = useOfflineQueue(ctx.userId);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const order: Record<Status, number> = { overdue: 0, pending: 1, done: 2 };
    return items
      .map((item) => {
        const serverIds = new Set(item.records.map((r) => r.id));
        const pending: DoneRecord[] = queued
          .filter((q) => q.occurrenceKey === item.key && !serverIds.has(q.id))
          .map((q) => ({
            id: q.id,
            ...q.summary,
            performer_name: "",
            performed_at: q.input.performed_at,
            photo_path: q.input.photo ? "local" : null,
            pending: true,
          }));
        const pendingIds = new Set(pending.map((r) => r.id));
        const records = [
          ...item.records,
          ...(added[item.key] ?? []).filter((r) => !serverIds.has(r.id) && !pendingIds.has(r.id)),
          ...pending,
        ];
        const status: Status = records.length ? "done" : now > Date.parse(item.due) ? "overdue" : "pending";
        return { item, records, status };
      })
      .sort((a, b) => order[a.status] - order[b.status] || Date.parse(a.item.due) - Date.parse(b.item.due));
  }, [items, added, now, queued]);

  const done = rows.filter((r) => r.status === "done").length;

  if (!items.length) return <p className="text-lg text-muted">{t("tasks.nothingToday")}</p>;

  return (
    <>
      <SyncBanner online={online} queued={queued.length} syncing={syncing} />
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">{t("tasks.progress", { done, total: rows.length })}</p>
        <div className="h-3 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-ok transition-all" style={{ width: `${(done / rows.length) * 100}%` }} />
        </div>
        {done === rows.length && (
          <p className="rounded-lg border-2 border-ok bg-ok-bg px-4 py-3 font-semibold text-ok">{t("tasks.allDone")}</p>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map(({ item, records, status }) => (
          <li key={item.key}>
            <TaskCard
              item={item}
              records={records}
              status={status}
              tz={tz}
              ctx={ctx}
              onSaved={(r) => setAdded((prev) => ({ ...prev, [item.key]: [...(prev[item.key] ?? []), r] }))}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------

const statusStyles: Record<Status, string> = {
  done: "border-ok",
  pending: "border-line",
  overdue: "border-warn",
};

function TaskCard({
  item,
  records,
  status,
  tz,
  ctx,
  onSaved,
}: {
  item: ChecklistItem;
  records: DoneRecord[];
  status: Status;
  tz: string;
  ctx: SubmitContext;
  onSaved: (r: DoneRecord) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }), [locale, tz]);

  // formulářový stav
  const [value, setValue] = useState("");
  const [corrective, setCorrective] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(item.photoRequired);
  const [expiryFound, setExpiryFound] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [product, setProduct] = useState("");
  const [packageOk, setPackageOk] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const limits = { min_value: item.min_value, max_value: item.max_value, unit: item.unit };
  const numeric = parseDecimal(value);
  const tempDeviation = outOfLimits(numeric, limits);
  const receiptDeviation = (numeric != null && outOfLimits(numeric, limits)) || !packageOk;
  const isDone = records.length > 0;
  const canAddMore = item.repeatable;

  function reset() {
    setValue("");
    setCorrective("");
    setNote("");
    setPhoto(null);
    setExtrasOpen(item.photoRequired);
    setExpiryFound(false);
    setReceiptOpen(false);
    setSupplier("");
    setProduct("");
    setPackageOk(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save(partial: Pick<RecordInput, "value" | "details" | "corrective_action">, deviation: boolean) {
    setError(null);
    if (item.photoRequired && !photo) return setError("tasks.photoRequired");
    if (deviation && !corrective.trim()) return setError("tasks.errors.correctiveRequired");
    setPending(true);
    const input: RecordInput = {
      id: crypto.randomUUID(),
      template_id: item.templateId,
      task_date: item.date,
      slot: item.slot,
      note,
      performed_at: new Date().toISOString(),
      photo: photo ? await compressImage(photo) : null,
      corrective_action: deviation ? corrective : null,
      ...partial,
    };
    const summary = {
      value: input.value ?? null,
      is_deviation: deviation,
      details: input.details ?? {},
      corrective_action: input.corrective_action ?? null,
    };
    // offline (nebo výpadek během odesílání) → uložit do zařízení, odešle se později
    const result = navigator.onLine
      ? await submitRecord(createClient(), ctx, input)
      : ({ ok: false, error: "tasks.errors.network", retryable: true } as const);
    if (!result.ok && result.retryable) {
      await enqueue({ id: input.id, userId: ctx.userId, occurrenceKey: item.key, createdAt: new Date().toISOString(), ctx, input, summary });
      setPending(false);
      reset();
      return;
    }
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved({
      id: input.id,
      value: input.value ?? null,
      is_deviation: deviation,
      performer_name: "",
      performed_at: input.performed_at,
      details: input.details ?? {},
      corrective_action: input.corrective_action ?? null,
      photo_path: photo ? "local" : null,
    });
    reset();
    router.refresh();
  }

  const slotLabel = t(`tasks.slot.${item.slot}`);
  const showForm = !isDone || (canAddMore && receiptOpen);

  return (
    <article className={`flex flex-col gap-3 rounded-xl border-l-8 border-2 bg-white p-4 ${statusStyles[status]}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold leading-tight">
            {slotLabel && <span className="mr-2 text-muted">{slotLabel}:</span>}
            {item.title}
          </h2>
          <p className="text-muted">
            {t("tasks.due", { time: time.format(new Date(item.due)) })}
            {(item.category === "temperature" || item.category === "goods_receipt") &&
              (item.min_value != null || item.max_value != null) &&
              ` · ${t("tasks.limit", { range: formatLimits(limits, locale) })}`}
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      {item.instructions && !isDone && <p className="text-muted">{item.instructions}</p>}

      {records.length > 0 && (
        <ul className="flex flex-col gap-1">
          {records.map((r) => (
            <li
              key={r.id}
              className={`rounded-lg px-3 py-2 ${r.is_deviation ? "border-2 border-danger bg-danger-bg text-danger" : "bg-ok-bg text-ok"}`}
            >
              <span className="font-semibold">
                {r.pending ? "⏳" : "✓"} {r.value != null && `${r.value.toLocaleString(locale)} ${item.unit} · `}
                {typeof r.details.supplier === "string" && `${r.details.supplier} · `}
                {r.is_deviation && `${t("tasks.deviation")} · `}
                {time.format(new Date(r.performed_at))}
                {r.performer_name && ` · ${r.performer_name}`}
                {r.photo_path && " · 📷"}
              </span>
              {r.corrective_action && <span className="block text-sm">{r.corrective_action}</span>}
              {r.pending && <span className="block text-sm font-semibold text-warn">{t("offline.queued")}</span>}
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <>
          {/* --- teplota --- */}
          {item.category === "temperature" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="font-semibold">{t("tasks.temperature", { unit: item.unit })}</span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={`min-h-16 rounded-lg border-2 px-4 text-3xl font-bold ${tempDeviation ? "border-danger bg-danger-bg text-danger" : "border-ink"}`}
                    aria-invalid={tempDeviation}
                  />
                </label>
                <button
                  type="button"
                  disabled={pending || numeric == null}
                  onClick={() => save({ value: numeric }, tempDeviation)}
                  className={`mt-auto min-h-16 rounded-lg px-6 text-xl font-bold text-white disabled:opacity-40 ${tempDeviation ? "bg-danger" : "bg-ok"}`}
                >
                  {pending ? t("tasks.saving") : tempDeviation ? t("tasks.saveDeviation") : t("tasks.save")}
                </button>
              </div>
              {tempDeviation && <Corrective value={corrective} onChange={setCorrective} label={t("tasks.outOfLimit")} />}
            </div>
          )}

          {/* --- úklid / ostatní --- */}
          {(item.category === "cleaning" || item.category === "other") && (
            <button
              type="button"
              disabled={pending}
              onClick={() => save({}, false)}
              className="min-h-16 rounded-lg bg-ok text-xl font-bold text-white disabled:opacity-40"
            >
              {pending ? t("tasks.saving") : `✓ ${t("tasks.markDone")}`}
            </button>
          )}

          {/* --- trvanlivost --- */}
          {item.category === "expiry" && (
            <div className="flex flex-col gap-3">
              {!expiryFound ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save({ details: { ok: true } }, false)}
                    className="min-h-16 rounded-lg bg-ok text-lg font-bold text-white disabled:opacity-40"
                  >
                    {pending ? t("tasks.saving") : `✓ ${t("tasks.expiryOk")}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiryFound(true)}
                    className="min-h-16 rounded-lg border-2 border-danger bg-white text-lg font-bold text-danger"
                  >
                    {t("tasks.expiryFound")}
                  </button>
                </div>
              ) : (
                <>
                  <Corrective value={corrective} onChange={setCorrective} label={t("tasks.expiryFoundLabel")} />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save({ details: { ok: false }, corrective_action: corrective }, true)}
                    className="min-h-16 rounded-lg bg-danger text-xl font-bold text-white disabled:opacity-40"
                  >
                    {pending ? t("tasks.saving") : t("tasks.saveDeviation")}
                  </button>
                </>
              )}
            </div>
          )}

          {/* --- příjem zboží --- */}
          {item.category === "goods_receipt" && !receiptOpen && (
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="min-h-16 rounded-lg bg-brand text-xl font-bold text-white"
            >
              {t("tasks.receiptAdd")}
            </button>
          )}
          {item.category === "goods_receipt" && receiptOpen && (
            <div className="flex flex-col gap-3">
              <TextInput label={t("tasks.supplier")} value={supplier} onChange={setSupplier} />
              <TextInput label={t("tasks.product")} value={product} onChange={setProduct} />
              <label className="flex flex-col gap-1">
                <span className="font-semibold">{t("tasks.temperature", { unit: item.unit })}</span>
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={`min-h-14 rounded-lg border-2 px-4 text-2xl font-bold ${numeric != null && outOfLimits(numeric, limits) ? "border-danger bg-danger-bg text-danger" : "border-ink"}`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3" role="radiogroup">
                <Toggle active={packageOk} onClick={() => setPackageOk(true)} tone="ok">
                  {t("tasks.packageOk")}
                </Toggle>
                <Toggle active={!packageOk} onClick={() => setPackageOk(false)} tone="danger">
                  {t("tasks.packageDamaged")}
                </Toggle>
              </div>
              {receiptDeviation && <Corrective value={corrective} onChange={setCorrective} label={t("tasks.receiptDeviation")} />}
              <button
                type="button"
                disabled={pending || !supplier.trim()}
                onClick={() =>
                  save(
                    {
                      value: numeric,
                      details: { supplier: supplier.trim(), product: product.trim(), temperature: numeric, package_ok: packageOk },
                      corrective_action: corrective,
                    },
                    receiptDeviation,
                  )
                }
                className={`min-h-16 rounded-lg text-xl font-bold text-white disabled:opacity-40 ${receiptDeviation ? "bg-danger" : "bg-ok"}`}
              >
                {pending ? t("tasks.saving") : receiptDeviation ? t("tasks.saveDeviation") : t("tasks.save")}
              </button>
            </div>
          )}

          {/* --- fotka + poznámka (volitelné) --- */}
          {(item.category !== "goods_receipt" || receiptOpen) && (
            <div className="flex flex-col gap-3">
              {!extrasOpen ? (
                <button type="button" onClick={() => setExtrasOpen(true)} className="self-start font-semibold text-brand underline">
                  {t("tasks.extras")}
                </button>
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="font-semibold">
                      {t("tasks.photo")} {item.photoRequired && <span className="text-danger">*</span>}
                    </span>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                      className="min-h-12 text-base file:mr-3 file:min-h-12 file:rounded-lg file:border-2 file:border-ink file:bg-white file:px-4 file:font-semibold"
                    />
                  </label>
                  <TextInput label={t("tasks.note")} value={note} onChange={setNote} />
                </>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border-2 border-danger bg-danger-bg px-4 py-3 font-semibold text-danger">
              {t(error)}
            </p>
          )}
        </>
      )}

      {isDone && canAddMore && !receiptOpen && (
        <button
          type="button"
          onClick={() => setReceiptOpen(true)}
          className="min-h-12 self-start rounded-lg border-2 border-ink bg-white px-4 font-semibold"
        >
          {t("tasks.receiptAnother")}
        </button>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const t = useT();
  const cls = {
    done: "bg-ok text-white",
    pending: "bg-page text-ink border-2 border-line",
    overdue: "bg-warn-bg text-warn border-2 border-warn",
  }[status];
  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${cls}`}>{t(`tasks.status.${status}`)}</span>;
}

function Corrective({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const t = useT();
  return (
    <label className="flex flex-col gap-1">
      <span className="font-bold text-danger">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        required
        placeholder={t("tasks.correctivePlaceholder")}
        className="rounded-lg border-2 border-danger px-4 py-3 text-lg"
      />
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="min-h-12 rounded-lg border-2 border-line px-4 text-lg" />
    </label>
  );
}

function Toggle({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: "ok" | "danger";
  children: React.ReactNode;
}) {
  const on = tone === "ok" ? "bg-ok text-white border-ok" : "bg-danger text-white border-danger";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`min-h-14 rounded-lg border-2 text-lg font-bold ${active ? on : "border-ink bg-white text-ink"}`}
    >
      {children}
    </button>
  );
}
