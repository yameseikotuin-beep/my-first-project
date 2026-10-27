import Link from 'next/link';
import type { ComponentProps } from 'react';
import { LinkPending } from './link-pending';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';

const sizes: Record<Size, string> = {
  md: 'min-h-12 px-6 text-base',
  sm: 'min-h-10 px-4 text-sm',
};

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-strong active:bg-primary-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted active:bg-primary-soft',
  ghost: 'text-primary underline-offset-4 hover:underline active:bg-primary-soft',
  danger: 'border border-danger bg-surface text-danger hover:bg-danger-soft active:bg-danger-soft',
};

export function buttonClass(variant: Variant = 'primary', extra = '', size: Size = 'md'): string {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, className, size)} {...props} />;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link className={buttonClass(variant, className, size)} {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}
