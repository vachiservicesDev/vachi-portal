import { NextRequest } from 'next/server';

export function jsonRequest(body: unknown, url = 'http://localhost/test'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function formDataRequest(fields: Record<string, string>, url = 'http://localhost/test'): NextRequest {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new NextRequest(url, { method: 'POST', body: form });
}

export function getRequest(url = 'http://localhost/test'): NextRequest {
  return new NextRequest(url);
}
