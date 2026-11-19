"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { employeeLogout } from "@/app/tablet/actions";
import { useT } from "@/i18n/client";
import { flushQueue, listQueued, QUEUE_EVENT, type QueuedRecord } from "@/lib/offline/queue";
import { createClient } from "@/lib/supabase/client";

/** Stav připojení + čekající záznamy aktuálního uživatele; automatická synchronizace. */
export function useOfflineQueue(userId: string) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<QueuedRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(() => listQueued(userId).then(setQueued), [userId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = await listQueued(userId);
    if (!pending.length) return;
    setSyncing(true);
    const { sent } = await flushQueue(createClient(), userId);
    setSyncing(false);
    await reload();
    if (sent) router.refresh();
  }, [userId, reload, router]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const goOnline = () => {
      update();
      void sync();
    };
    update();
    void reload().then(sync);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", update);
    window.addEventListener(QUEUE_EVENT, reload);
    const interval = setInterval(() => void sync(), 30_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", update);
      window.removeEventListener(QUEUE_EVENT, reload);
      clearInterval(interval);
    };
  }, [reload, sync]);

  return { online, queued, syncing, sync };
}

export function SyncBanner({ online, queued, syncing }: { online: boolean; queued: number; syncing: boolean }) {
  const t = useT();
  if (online && !queued) return null;
  return (
    <div role="status" className="rounded-lg border-2 border-warn bg-warn-bg px-4 py-3 font-semibold text-warn">
      {!online && <p>📴 {t("offline.offlineBanner")}</p>}
      {queued > 0 && <p>{syncing ? t("offline.syncing") : t("offline.pendingCount", { count: queued })}</p>}
    </div>
  );
}

/** Odhlášení: nejdřív odeslat frontu, jinak by záznamy zůstaly v zařízení. */
export function LogoutButton({ userId }: { userId: string }) {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage(null);
          let left = (await listQueued(userId)).length;
          if (left && navigator.onLine) left = (await flushQueue(createClient(), userId)).left;
          if (left) {
            setMessage(t("offline.logoutBlocked", { count: left }));
            setPending(false);
            return;
          }
          await employeeLogout();
        }}
        className="min-h-14 rounded-lg border-2 border-ink bg-white px-6 text-lg font-semibold disabled:opacity-50"
      >
        {pending ? t("common.loading") : t("common.logout")}
      </button>
      {message && <p className="max-w-xs text-right text-sm font-semibold text-danger">{message}</p>}
    </div>
  );
}
