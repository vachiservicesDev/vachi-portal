import { createAdminClient } from '@/lib/supabase/admin';

export const I9_BUCKET = 'i9-records';

/** Must be created as a PRIVATE bucket in the Supabase dashboard, same as onboarding-documents. */
export async function uploadI9Snapshot(path: string, bytes: Uint8Array): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(I9_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });

  if (error) throw new Error(`Failed to upload ${path}: ${error.message}`);
}
