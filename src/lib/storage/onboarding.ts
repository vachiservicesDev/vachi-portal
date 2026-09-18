import { createAdminClient } from '@/lib/supabase/admin';

export const ONBOARDING_BUCKET = 'onboarding-documents';

/**
 * Uploads/downloads generated and signed onboarding documents. Uses the
 * admin (service-role) client deliberately: these files belong to the
 * onboarding session, not directly to the signed-in user making the
 * request (an admin generates them on an employee's behalf), so per-user
 * Storage RLS doesn't apply cleanly here. The bucket itself must be created
 * as **private** in the Supabase dashboard (Storage -> New bucket ->
 * uncheck "Public bucket") — access is only ever through these
 * server-side helpers, never a public URL.
 */
export async function uploadOnboardingFile(path: string, bytes: Uint8Array): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(ONBOARDING_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });

  if (error) throw new Error(`Failed to upload ${path}: ${error.message}`);
}

export async function downloadOnboardingFile(path: string): Promise<Uint8Array> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(ONBOARDING_BUCKET).download(path);

  if (error || !data) throw new Error(`Failed to download ${path}: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function getOnboardingFileSignedUrl(path: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(ONBOARDING_BUCKET)
    .createSignedUrl(path, 60 * 10); // 10 minutes

  if (error || !data) throw new Error(`Failed to sign URL for ${path}: ${error?.message}`);
  return data.signedUrl;
}
