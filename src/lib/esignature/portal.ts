import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Free, in-portal signing: the employee opens the document in the portal, types their full name
 * and agrees to sign electronically. That consent, the typed name, the time, IP address and a
 * fingerprint of the exact document they saw are stamped onto the PDF and kept in the audit log,
 * which is what US e-signature law (ESIGN / UETA) asks for. No outside vendor or account needed.
 */

export const PORTAL_PROVIDER = 'portal';

export interface PortalSignature {
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
  documentId: string;
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Lowercased, single-spaced, accents stripped: "  José  Díaz " and "jose diaz" match. */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** pdf-lib's standard fonts only cover WinAnsi, so drop anything they can't draw. */
function printable(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?');
}

/** Returns the signed PDF: a signature block on the document's last page plus a signing certificate page. */
export async function stampSignature(original: Uint8Array, sig: PortalSignature): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const navy = rgb(0.1, 0.31, 0.53);
  const ink = rgb(0.1, 0.1, 0.1);
  const when = sig.signedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const fingerprint = sha256(original);

  const last = pdf.getPage(pdf.getPageCount() - 1);
  last.drawRectangle({ x: 56, y: 96, width: 500, height: 92, borderColor: navy, borderWidth: 1 });
  last.drawText('Electronically signed by', { x: 68, y: 170, size: 9, font, color: navy });
  last.drawText(printable(sig.signerName), { x: 68, y: 140, size: 22, font: script, color: ink });
  last.drawText(`${when}  -  Vachi Employee Portal  -  Document ${sig.documentId}`, { x: 68, y: 108, size: 8, font, color: ink });

  const cert = pdf.addPage([612, 792]);
  let y = 730;
  const line = (label: string, value: string) => {
    cert.drawText(label, { x: 56, y, size: 10, font: bold, color: ink });
    cert.drawText(printable(value), { x: 200, y, size: 10, font, color: ink });
    y -= 22;
  };
  cert.drawText('Signing certificate', { x: 56, y, size: 18, font: bold, color: navy });
  y -= 36;
  line('Signer', sig.signerName);
  line('Email', sig.signerEmail);
  line('Signed at', when);
  line('IP address', sig.ipAddress || 'unknown');
  line('Browser', sig.userAgent.slice(0, 70) || 'unknown');
  line('Document ID', sig.documentId);
  line('Original SHA-256', fingerprint.slice(0, 32));
  line('', fingerprint.slice(32));
  y -= 12;
  for (const text of [
    'The signer signed in to the Vachi Employee Portal with their own password, reviewed this',
    'document, typed their full legal name and agreed that it is their electronic signature,',
    'with the same effect as a handwritten signature. The fingerprint above identifies the exact',
    'document they reviewed. Signed through the Vachi Employee Portal, Vachi Services LLC.',
  ]) {
    cert.drawText(text, { x: 56, y, size: 10, font, color: ink });
    y -= 16;
  }

  return pdf.save();
}
