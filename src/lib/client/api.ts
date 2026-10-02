'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  message: string | null;
  fieldErrors: Record<string, string>;
};

const GENERIC = "Something went wrong on our side. Try again, and if it keeps happening, contact HR.";

function messageFor(status: number, body: { message?: string } | null): string {
  if (body?.message && body.message !== 'Invalid input') return body.message;
  if (status === 400) return 'Some fields need attention.';
  if (status === 401) return 'Your session ended. Sign in again to continue.';
  if (status === 403) return "You don't have access to do that.";
  if (status === 404) return "We couldn't find that record. It may have been removed.";
  if (status === 409) return body?.message ?? 'That conflicts with an existing record.';
  return GENERIC;
}

/** Zod's flatten() puts field errors under errors.fieldErrors; keep the first message per field. */
function fieldErrorsFrom(body: unknown): Record<string, string> {
  const errors = (body as { errors?: { fieldErrors?: Record<string, string[] | undefined> } } | null)?.errors?.fieldErrors;
  if (!errors) return {};
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, v]) => v && v.length)
      .map(([k, v]) => [k, (v as string[])[0]]),
  );
}

/** Calls one of the portal's API routes with JSON and never throws. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.assign(`/login?reason=expired&next=${encodeURIComponent(window.location.pathname)}`);
    }
    const body = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (body as T) : null,
      message: res.ok ? null : messageFor(res.status, body),
      fieldErrors: res.ok ? {} : fieldErrorsFrom(body),
    };
  } catch {
    return { ok: false, status: 0, data: null, message: "Couldn't reach the portal. Check your connection and try again.", fieldErrors: {} };
  }
}

/**
 * A form's values as a plain object. Empty fields are left out so optional values reach the API
 * as "not given" rather than as empty strings (which would fail date and email checks).
 */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string' && value.trim() !== '') out[key] = value.trim();
  });
  return out;
}

/** Loads a GET endpoint, with loading and error state and a reload(). */
export function useResource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(url);
  urlRef.current = url;

  const reload = useCallback(async () => {
    if (!urlRef.current) return;
    const result = await api<T>(urlRef.current);
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [url, reload]);

  return { data, error, loading, reload, setData };
}

/** Runs a mutation: tracks busy state, the error message and per-field errors. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const run = useCallback(async <T,>(key: string, url: string, init: { method?: string; body?: unknown }, successMessage?: string) => {
    setBusy(key);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    const result = await api<T>(url, init);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors);
    } else if (successMessage) {
      setSuccess(successMessage);
    }
    return result;
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setSuccess(null);
    setFieldErrors({});
  }, []);

  return { run, busy, error, fieldErrors, success, setError, setSuccess, clear };
}
