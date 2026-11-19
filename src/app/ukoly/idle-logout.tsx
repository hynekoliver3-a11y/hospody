"use client";
import { useEffect } from "react";
import { employeeLogout } from "@/app/tablet/actions";

const IDLE_MS = 3 * 60 * 1000;

/** Sdílený tablet: po 3 minutách nečinnosti zaměstnance odhlásí. */
export function IdleLogout() {
  useEffect(() => {
    let timer = setTimeout(() => void employeeLogout(), IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void employeeLogout(), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);
  return null;
}
