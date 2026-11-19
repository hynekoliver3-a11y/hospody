// Ručně udržované typy řádků (odpovídají supabase/migrations). Po spuštění lokálního
// Supabase lze vygenerovat plné typy: npx supabase gen types typescript --local
export type TaskCategory = "temperature" | "cleaning" | "goods_receipt" | "expiry" | "other";
export type TaskFrequency = "daily" | "morning_evening" | "weekly";
export type TaskSlot = "day" | "morning" | "evening" | "week";

export interface Company {
  id: string;
  name: string;
  ico: string | null;
  address: string | null;
  locale: string;
}

export interface Location {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  timezone: string;
  public_slug: string;
  alert_email: string | null;
}

export interface Employee {
  id: string;
  company_id: string;
  location_id: string;
  user_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Device {
  id: string;
  company_id: string;
  location_id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

export interface TaskTemplate {
  id: string;
  company_id: string;
  location_id: string;
  category: TaskCategory;
  title: string;
  instructions: string | null;
  frequency: TaskFrequency;
  due_time: string;
  evening_due_time: string;
  weekday: number | null;
  min_value: number | null;
  max_value: number | null;
  unit: string;
  photo_required: boolean;
  repeatable: boolean;
  active: boolean;
  sort_order: number;
}
