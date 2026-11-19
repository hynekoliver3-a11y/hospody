"use client";
// Offline fronta záznamů v IndexedDB. Záznam (včetně fotky jako Blob) se uloží do zařízení
// a odešle se, jakmile je připojení – vždy pod stejným uživatelem, který ho pořídil.
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitRecord, type RecordInput, type SubmitContext } from "@/lib/tasks/submit";

export interface QueuedRecord {
  id: string; // = RecordInput.id (idempotence)
  userId: string;
  occurrenceKey: string;
  createdAt: string;
  ctx: SubmitContext;
  input: RecordInput; // včetně photo: Blob | null
  summary: { value: number | null; is_deviation: boolean; details: Record<string, unknown>; corrective_action: string | null };
}

const DB = "haccp-offline";
const STORE = "records";
export const QUEUE_EVENT = "haccp-queue-changed";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close()) as Promise<T>;
}

const notify = () => window.dispatchEvent(new Event(QUEUE_EVENT));

export async function enqueue(item: QueuedRecord) {
  await tx("readwrite", (s) => s.put(item));
  notify();
}

export async function listQueued(userId: string): Promise<QueuedRecord[]> {
  try {
    const all = await tx<QueuedRecord[]>("readonly", (s) => s.getAll());
    return all.filter((r) => r.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return []; // IndexedDB nedostupná (např. anonymní okno)
  }
}

async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  notify();
}

let flushing: Promise<{ sent: number; left: number }> | null = null;

/** Odešle čekající záznamy aktuálního uživatele. Paralelní volání sdílí jeden běh. */
export function flushQueue(supabase: SupabaseClient, userId: string) {
  flushing ??= (async () => {
    let sent = 0;
    const items = await listQueued(userId);
    for (const item of items) {
      if (!navigator.onLine) break;
      const result = await submitRecord(supabase, item.ctx, item.input);
      if (result.ok) {
        await remove(item.id);
        sent++;
      } else if (!result.retryable) {
        // trvalá chyba (např. záznam starší 7 dní) – opakování nepomůže
        console.warn("Záznam z offline fronty odmítnut", result.error, item);
        await remove(item.id);
      } else {
        break; // síť stále nefunguje
      }
    }
    return { sent, left: (await listQueued(userId)).length };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
