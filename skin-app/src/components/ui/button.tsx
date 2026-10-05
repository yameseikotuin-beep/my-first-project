import Link from 'next/link';
import type { ComponentProps } from 'react';
import { LinkPending } from './link-pending';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

// 押した瞬間に少し縮み、色が濃くなる（触れたことが分かるように）
const base =
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition-[background-color,box-shadow,transform] duration-100 active:scale-[0.97] active:opacity-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-sage-strong text-white shadow-sm hover:bg-sage active:bg-[#3a5444] active:shadow-none',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted active:border-sage active:bg-sage-soft',
  ghost: 'text-sage-strong underline-offset-4 hover:underline active:bg-sage-soft',
  danger: 'border border-danger bg-surface text-danger hover:bg-danger-soft active:bg-[#f1d3d0]',
};

export function buttonClass(variant: Variant = 'primary', extra = ''): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={buttonClass(variant, className)} {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}
