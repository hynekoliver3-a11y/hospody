"use client";
import { useEffect } from "react";
import { employeeLogout } from "@/app/tablet/actions";
import { listQueued } from "@/lib/offline/queue";

const IDLE_MS = 3 * 60 * 1000;

/** Sdílený tablet: po 3 minutách nečinnosti zaměstnance odhlásí (ne offline / s neodeslanými záznamy). */
export function IdleLogout({ userId }: { userId: string }) {
  useEffect(() => {
    const fire = async () => {
      if (!navigator.onLine || (await listQueued(userId)).length) return reset();
      void employeeLogout();
    };
    let timer = setTimeout(fire, IDLE_MS);
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(fire, IDLE_MS);
    }
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [userId]);
  return null;
}
