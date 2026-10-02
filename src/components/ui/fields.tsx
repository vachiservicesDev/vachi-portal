// Form fields in the website's style: label above, 48px field, teal focus, red message under it.
// Uncontrolled by default (pages read them with FormData); pass value/onChange to control one.
import type { ChangeEventHandler, ReactNode } from 'react';

export const inputClass =
  'block w-full min-h-12 rounded-md border bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600/40 disabled:bg-subtle disabled:text-muted';
export const borderClass = (invalid: boolean) => (invalid ? 'border-danger-700' : 'border-line-input focus:border-teal-600');

export type FieldErrors = Record<string, string | undefined> | undefined;

type Base = {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  errors?: FieldErrors;
  className?: string;
  /** Drop the "(required)" / "(optional)" note, for short forms like sign-in where it is noise. */
  hideOptional?: boolean;
  disabled?: boolean;
  /** Needed only when the same field name appears more than once on a page. Defaults to f-{name}. */
  id?: string;
};

const fieldId = (name: string, id?: string) => id ?? `f-${name}`;

function describedBy(fid: string, hint: boolean, error: boolean) {
  return [hint && `${fid}-hint`, error && `${fid}-error`].filter(Boolean).join(' ') || undefined;
}

export function FieldLabel({ htmlFor, label, required, hideOptional }: { htmlFor: string; label: string; required?: boolean; hideOptional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {label}
      {hideOptional ? null : required ? (
        <span className="font-normal text-muted"> (required)</span>
      ) : (
        <span className="font-normal text-muted"> (optional)</span>
      )}
    </label>
  );
}

export function FieldHelp({ name: fid, hint, error }: { name: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${fid}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fid}-error`} className="mt-1.5 text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </>
  );
}

export function TextField({
  name,
  label,
  hint,
  required,
  errors,
  className = '',
  hideOptional,
  disabled,
  id,
  type = 'text',
  defaultValue,
  value,
  onChange,
  placeholder,
  autoComplete = 'off',
  inputMode,
  min,
  max,
  step,
  maxLength,
  readOnly,
}: Base & {
  type?: 'text' | 'email' | 'url' | 'tel' | 'date' | 'number' | 'password';
  defaultValue?: string | number | null;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'decimal' | 'email' | 'url' | 'tel' | 'text';
  min?: string | number;
  max?: string | number;
  step?: string | number;
  maxLength?: number;
  readOnly?: boolean;
}) {
  const error = errors?.[name];
  const fid = fieldId(name, id);
  return (
    <div className={`min-w-0 ${className}`}>
      <FieldLabel htmlFor={fid} label={label} required={required} hideOptional={hideOptional} />
      <input
        id={fid}
        name={name}
        type={type}
        {...(value !== undefined ? { value, onChange } : { defaultValue: defaultValue ?? undefined })}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={describedBy(fid, !!hint, !!error)}
        className={`${readOnly ? inputClass.replace('bg-white text-ink', 'bg-subtle text-ink-2 cursor-default') : inputClass} ${borderClass(!!error)} mt-1.5`}
      />
      <FieldHelp name={fid} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  required,
  errors,
  className = '',
  hideOptional,
  disabled,
  id,
  defaultValue,
  value,
  onChange,
  rows = 4,
  maxLength,
  placeholder,
}: Base & {
  defaultValue?: string | null;
  value?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const error = errors?.[name];
  const fid = fieldId(name, id);
  return (
    <div className={`min-w-0 ${className}`}>
      <FieldLabel htmlFor={fid} label={label} required={required} hideOptional={hideOptional} />
      <textarea
        id={fid}
        name={name}
        rows={rows}
        {...(value !== undefined ? { value, onChange } : { defaultValue: defaultValue ?? undefined })}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={describedBy(fid, !!hint, !!error)}
        className={`${inputClass} ${borderClass(!!error)} mt-1.5 resize-y`}
      />
      <FieldHelp name={fid} hint={hint} error={error} />
    </div>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  name,
  label,
  hint,
  required,
  errors,
  className = '',
  hideOptional,
  disabled,
  id,
  options,
  placeholder,
  defaultValue,
  value,
  onChange,
}: Base & {
  options: Option[];
  placeholder?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
}) {
  const error = errors?.[name];
  const fid = fieldId(name, id);
  return (
    <div className={`min-w-0 ${className}`}>
      <FieldLabel htmlFor={fid} label={label} required={required} hideOptional={hideOptional} />
      <select
        id={fid}
        name={name}
        {...(value !== undefined ? { value, onChange } : { defaultValue: defaultValue ?? (placeholder ? '' : undefined) })}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy(fid, !!hint, !!error)}
        className={`${inputClass} ${borderClass(!!error)} mt-1.5 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2716%27%20height%3D%2716%27%20fill%3D%27none%27%3E%3Cpath%20d%3D%27M4%206l4%204%204-4%27%20stroke%3D%27%235b6b80%27%20stroke-width%3D%271.75%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%2F%3E%3C%2Fsvg%3E")] bg-[length:16px_16px] bg-[position:right_14px_center] bg-no-repeat pr-10`}
      >
        {placeholder && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldHelp name={fid} hint={hint} error={error} />
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  errors,
  className = '',
  defaultChecked,
  checked,
  onChange,
  disabled,
  id,
}: Omit<Base, 'required' | 'hideOptional'> & { defaultChecked?: boolean; checked?: boolean; onChange?: ChangeEventHandler<HTMLInputElement>; value?: string }) {
  const error = errors?.[name];
  const fid = fieldId(name, id);
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <input
          id={fid}
          name={name}
          type="checkbox"
          {...(checked !== undefined ? { checked, onChange } : { defaultChecked })}
          disabled={disabled}
          aria-describedby={describedBy(fid, !!hint, !!error)}
          className="h-6 w-6 shrink-0 rounded border-line-input accent-navy-700"
        />
        <label htmlFor={fid} className="font-medium text-ink">
          {label}
        </label>
      </div>
      <div className="pl-9">
        <FieldHelp name={fid} hint={hint} error={error} />
      </div>
    </div>
  );
}

export function Fieldset({ legend, children, className = '' }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`grid gap-5 ${className}`}>
      <legend className="t-eyebrow mb-4">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** One column on phones, two from tablet up. */
export function FieldRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-5 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{children}</div>;
}
