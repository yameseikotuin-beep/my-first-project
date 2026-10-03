import type { ComponentProps } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(46,43,38,0.04)] sm:p-6 ${className}`}
      {...props}
    />
  );
}

export function PageTitle({ children, lead }: { children: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-serif text-2xl font-semibold tracking-wide sm:text-[1.75rem]">{children}</h1>
      <div aria-hidden className="mt-2 h-px w-12 bg-gold" />
      {lead ? <p className="mt-3 text-ink-muted">{lead}</p> : null}
    </header>
  );
}
