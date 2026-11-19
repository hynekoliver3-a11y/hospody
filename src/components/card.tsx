export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border-2 border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold sm:text-3xl">{children}</h1>;
}
