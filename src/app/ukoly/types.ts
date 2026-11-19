import type { TaskCategory, TaskSlot } from "@/lib/types";

export interface DoneRecord {
  id: string;
  value: number | null;
  is_deviation: boolean;
  performer_name: string;
  performed_at: string;
  details: Record<string, unknown>;
  corrective_action: string | null;
  photo_path: string | null;
}

export interface ChecklistItem {
  key: string;
  templateId: string;
  date: string;
  slot: TaskSlot;
  due: string; // ISO
  title: string;
  instructions: string | null;
  category: TaskCategory;
  min_value: number | null;
  max_value: number | null;
  unit: string;
  photoRequired: boolean;
  repeatable: boolean;
  records: DoneRecord[];
}
