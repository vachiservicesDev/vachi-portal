import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { loadOwnDocument } from '@/lib/esignature/access';
import { downloadOnboardingFile } from '@/lib/storage/onboarding';

/** Streams the document PDF to its employee or an admin: the signed copy once there is one. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const found = await loadOwnDocument(params.id, gate.profile);
  const path = found?.document.signedFilePath ?? found?.document.generatedFilePath;
  if (!found || !path) return NextResponse.json({ message: 'Document not found' }, { status: 404 });

  const bytes = await downloadOnboardingFile(path);
  const name = found.document.signedFilePath ? 'onboarding-acknowledgment-signed.pdf' : 'onboarding-acknowledgment.pdf';
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
