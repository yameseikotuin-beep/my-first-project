import type { ComponentProps, ReactNode } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return <section className={`rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6 ${className}`} {...props} />;
}

export function PageTitle({ children, lead, actions }: { children: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{children}</h1>
        {lead ? <p className="mt-1 text-ink-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-bold">{children}</h2>;
}
