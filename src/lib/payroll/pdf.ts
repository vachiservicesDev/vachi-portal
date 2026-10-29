import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { FILING_STATUSES, type StatementLine } from './stub';
import type { LoadedStatement } from './load';

const NAVY = rgb(0.1, 0.31, 0.53);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.45, 0.5);
const RULE = rgb(0.8, 0.83, 0.87);
const TINT = rgb(0.94, 0.96, 0.98);

const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const date = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};
/** Standard fonts only draw WinAnsi characters. */
const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?');

/**
 * A one-page earnings statement in the layout ADP and other payroll providers use: employer and
 * period at the top, the employee's mailing block, earnings with rate and hours, statutory and
 * other deductions shown as negatives with year-to-date, net pay, and a non-negotiable deposit
 * advice at the bottom.
 */
export async function renderStubPdf({ stub, run, employee, company: COMPANY, statement }: LoadedStatement): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Earnings statement ${run.payDate}`);
  pdf.setAuthor(COMPANY.name);
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const L = 36;
  const R = 576;
  const name = `${employee.firstName} ${employee.lastName}`;
  const statementNo = stub.id.slice(0, 8).toUpperCase();
  const employeeNo = employee.id.slice(0, 8).toUpperCase();

  const text = (s: string, x: number, y: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const f = o.f ?? font;
    const size = o.size ?? 8.5;
    const t = safe(s);
    page.drawText(t, { x: o.right ? x - f.widthOfTextAtSize(t, size) : x, y, size, font: f, color: o.color ?? INK });
  };
  const hline = (y: number, x1 = L, x2 = R, color = RULE, thickness = 0.75) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });

  // ---- Header ----
  let y = 752;
  text(COMPANY.name, L, y, { f: bold, size: 13 });
  text('Earnings Statement', R, y, { f: bold, size: 15, color: NAVY, right: true });
  const companyLines = COMPANY.address ? COMPANY.address.split(/\n|;/).map((s) => s.trim()).filter(Boolean) : [];
  companyLines.forEach((line, i) => text(line, L, y - 12 - i * 10));
  const contact = [COMPANY.phone, COMPANY.ein && `FEIN ${COMPANY.ein}`].filter(Boolean).join('   ');
  if (contact) text(contact, L, y - 12 - companyLines.length * 10, { color: MUTED });

  const facts: [string, string][] = [
    ['Period Beginning:', date(run.payPeriodStart)],
    ['Period Ending:', date(run.payPeriodEnd)],
    ['Pay Date:', date(run.payDate)],
    ['Statement No.:', statementNo],
  ];
  facts.forEach(([k, v], i) => {
    text(k, 450, y - 16 - i * 11, { color: MUTED });
    text(v, R, y - 16 - i * 11, { right: true });
  });

  // ---- Employee: tax info left, mailing block right ----
  y = 680;
  text('Employee ID', L, y, { color: MUTED });
  text(employeeNo, 135, y);
  text('Taxable Filing Status:', L, y - 11, { color: MUTED });
  text(statement.filingStatus ? FILING_STATUSES[statement.filingStatus] : 'On file (W-4)', 135, y - 11);
  if (employee.position || employee.department) {
    text('Position', L, y - 22, { color: MUTED });
    text([employee.position, employee.department].filter(Boolean).join(', '), 135, y - 22);
  }
  text(name.toUpperCase(), 360, y, { f: bold, size: 10 });
  const addr = (employee.address ?? '').split(/\n|;/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (addr.length) addr.forEach((line, i) => text(line.toUpperCase(), 360, y - 12 - i * 11));
  else text('Address not on file', 360, y - 12, { color: MUTED });

  // ---- Earnings ----
  y = 620;
  const header = (title: string, cols: [string, number][]) => {
    page.drawRectangle({ x: L, y: y - 4, width: R - L, height: 15, color: TINT });
    text(title, L + 4, y, { f: bold, color: NAVY });
    cols.forEach(([c, x]) => text(c, x, y, { f: bold, color: NAVY, right: true }));
    y -= 15;
  };
  const row = (label: string, cells: [string, number][], o: { bold?: boolean } = {}) => {
    text(label, L + 4, y, { f: o.bold ? bold : font });
    cells.forEach(([c, x]) => text(c, x, y, { f: o.bold ? bold : font, right: true }));
    y -= 12;
  };

  header('Earnings', [['rate', 250], ['hours', 310], ['this period', 420], ['year to date', R - 4]]);
  const earn = (l: StatementLine) =>
    row(l.label, [
      [l.rate !== undefined ? num(l.rate) : '', 250],
      [l.hours !== undefined ? num(l.hours) : '', 310],
      [l.current ? num(l.current) : '', 420],
      [num(l.ytd), R - 4],
    ]);
  statement.earnings.forEach(earn);
  hline(y + 8, L + 300, R);
  row('Gross Pay', [[usd(statement.totals.gross[0]), 420], [num(statement.totals.gross[1]), R - 4]], { bold: true });
  y -= 8;

  // ---- Deductions ----
  header('Deductions', [['this period', 420], ['year to date', R - 4]]);
  const neg = (n: number) => (n ? `-${num(n)}` : '');
  text('Statutory', L + 4, y, { f: bold, size: 8, color: MUTED });
  y -= 12;
  statement.taxes.forEach((l) => row(`${l.label}${/tax$/i.test(l.label) ? '' : ' Tax'}`, [[neg(l.current), 420], [num(l.ytd), R - 4]]));
  if (statement.deductions.length) {
    y -= 2;
    text('Other', L + 4, y, { f: bold, size: 8, color: MUTED });
    y -= 12;
    statement.deductions.forEach((l) => row(`${l.label}${l.preTax ? '*' : ''}`, [[neg(l.current), 420], [num(l.ytd), R - 4]]));
  }
  hline(y + 8, L + 300, R);
  page.drawRectangle({ x: L, y: y - 5, width: R - L, height: 17, color: TINT });
  row('Net Pay', [[usd(statement.totals.net[0]), 420], [num(statement.totals.net[1]), R - 4]], { bold: true });
  y -= 10;
  if (statement.deductions.some((d) => d.preTax)) {
    text('* Excluded from federal taxable wages.', L + 4, y, { size: 7.5, color: MUTED });
    y -= 12;
  }

  // ---- Totals box ----
  y -= 6;
  const box = (label: string, cur: number, ytd: number, x: number) => {
    page.drawRectangle({ x, y: y - 30, width: 128, height: 38, borderColor: RULE, borderWidth: 0.75 });
    text(label, x + 6, y - 2, { size: 7.5, color: MUTED });
    text(usd(cur), x + 6, y - 15, { f: bold, size: 10 });
    text(`YTD ${usd(ytd)}`, x + 6, y - 26, { size: 7.5, color: MUTED });
  };
  box('Gross pay', statement.totals.gross[0], statement.totals.gross[1], L);
  box('Taxes', statement.totals.taxes[0], statement.totals.taxes[1], L + 137);
  box('Deductions', statement.totals.deductions[0], statement.totals.deductions[1], L + 274);
  box('Net pay', statement.totals.net[0], statement.totals.net[1], L + 411);
  y -= 50;
  text('Questions about this statement? Message HR in the Vachi Employee Portal.', L, Math.max(y, 230), { size: 7.5, color: MUTED });

  // ---- Deposit advice (detachable, non-negotiable) ----
  y = 200;
  for (let x = L; x < R; x += 8) page.drawLine({ start: { x, y }, end: { x: Math.min(x + 4, R), y }, thickness: 0.6, color: MUTED });
  y -= 22;
  text(COMPANY.name, L, y, { f: bold, size: 10 });
  text(statement.paymentMethod === 'check' ? 'Pay Statement' : 'Advice of Deposit', R, y, { f: bold, size: 11, color: NAVY, right: true });
  y -= 12;
  companyLines.slice(0, 2).forEach((line, i) => text(line, L, y - i * 10, { color: MUTED }));
  text(`Advice number: ${statementNo}`, R, y, { right: true });
  text(`Pay date: ${date(run.payDate)}`, R, y - 11, { right: true });
  y -= 40;
  text(statement.paymentMethod === 'check' ? 'Pay to the order of:' : 'Deposited to the account of', L, y, { color: MUTED });
  text(statement.paymentMethod === 'check' ? 'Paid by check' : 'Account number', 330, y, { color: MUTED });
  text('Amount', R, y, { color: MUTED, right: true });
  y -= 13;
  text(name.toUpperCase(), L, y, { f: bold, size: 10 });
  text(statement.paymentMethod === 'check' ? '' : statement.depositLast4 ? `xxxxxx${statement.depositLast4}` : 'On file', 330, y, { size: 10 });
  text(usd(statement.totals.net[0]), R, y, { f: bold, size: 11, right: true });
  y -= 24;
  hline(y + 8);
  text('NON-NEGOTIABLE', (L + R) / 2 + 45, y - 8, { f: bold, size: 16, color: RULE, right: true });
  text('This is not a check.', L, y - 8, { color: MUTED });
  return pdf.save();
}
