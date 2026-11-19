function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Chybí proměnná prostředí ${name} (viz .env.example)`);
  return value;
}

// NEXT_PUBLIC_* musí být čteny staticky, aby je Next.js vložil do klientského bundlu.
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const serverEnv = {
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  employeeEmailDomain: () => process.env.EMPLOYEE_EMAIL_DOMAIN ?? "employees.invalid",
};
