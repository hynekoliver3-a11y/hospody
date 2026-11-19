// 14 alergenů dle přílohy II nařízení EU č. 1169/2011. Názvy jsou v i18n (allergens.<číslo>).
export const ALLERGEN_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export interface MenuItem {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  allergens: number[];
  active: boolean;
  sort_order: number;
}

export function groupByCategory<T extends { category: string | null }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const i of items) {
    const key = i.category?.trim() || "";
    map.set(key, [...(map.get(key) ?? []), i]);
  }
  return [...map.entries()];
}
