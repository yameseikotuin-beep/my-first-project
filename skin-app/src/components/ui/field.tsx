import type { ComponentProps, ReactNode } from 'react';

const inputClass =
  'mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted/70 aria-[invalid=true]:border-danger';

type FieldProps = {
  label: string;
  name: string;
  error?: string[] | string;
  hint?: ReactNode;
  required?: boolean;
};

function FieldShell({ label, name, error, hint, required, children }: FieldProps & { children: ReactNode }) {
  const errors = typeof error === 'string' ? [error] : error;
  return (
    <div>
      <label htmlFor={name} className="block font-medium">
        {label}
        {required ? <span className="ml-2 text-sm text-danger">必須</span> : <span className="ml-2 text-sm text-ink-muted">任意</span>}
      </label>
      {hint ? (
        <p id={`${name}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {errors?.length ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger">
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(name: string, hint: unknown, error: unknown) {
  return [hint ? `${name}-hint` : '', error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined;
}

export function TextField({
  label,
  name,
  error,
  hint,
  required,
  ...props
}: FieldProps & Omit<ComponentProps<'input'>, 'name'>) {
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required}>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={inputClass}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  required,
  ...props
}: FieldProps & Omit<ComponentProps<'textarea'>, 'name'>) {
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required}>
      <textarea
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={`${inputClass} min-h-28`}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  required,
  children,
  ...props
}: FieldProps & Omit<ComponentProps<'select'>, 'name'>) {
  return (
    <FieldShell label={label} name={name} error={error} hint={hint} required={required}>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={inputClass}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
