import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Company } from './stub';
import type { Register, W2 } from './totals';

const NAVY = rgb(0.1, 0.31, 0.53);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.45, 0.5);
const RULE = rgb(0.55, 0.6, 0.65);
const TINT = rgb(0.94, 0.96, 0.98);

const num = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
/** Standard fonts only draw WinAnsi characters. */
const safe = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
const lines = (s: string | null | undefined) =>
  (s ?? '')
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);

type Text = (
  s: string,
  x: number,
  y: number,
  o?: {
    f?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    right?: boolean;
  },
) => void;

async function setup(title: string, author: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor(author);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const writer =
    (page: PDFPage): Text =>
    (s, x, y, o = {}) => {
      const f = o.f ?? font;
      const size = o.size ?? 8.5;
      const t = safe(s);
      page.drawText(t, {
        x: o.right ? x - f.widthOfTextAtSize(t, size) : x,
        y,
        size,
        font: f,
        color: o.color ?? INK,
      });
    };
  return { pdf, font, bold, writer };
}

export interface W2Party {
  name: string;
  address: string | null;
  ssn: string;
  controlNumber: string;
}

const COPIES = [
  ['Copy B', "To be filed with employee's FEDERAL tax return."],
  ['Copy C', "For EMPLOYEE'S RECORDS."],
  ['Copy 2', "To be filed with employee's state, city, or local income tax return."],
] as const;

/**
 * Form W-2 employee copies B, C and 2 on one letter page, laid out box for box like the IRS form.
 * Employees may receive these electronically once they consent; Copy A goes to the SSA separately.
 */
export async function renderW2Pdf(w2: W2, employee: W2Party, company: Company): Promise<Uint8Array> {
  const { pdf, bold, writer } = await setup(`Form W-2 ${w2.year}`, company.name);
  let page = pdf.addPage([612, 792]);
  let text = writer(page);
  const L = 30;
  const W = 552;
  const H = 238;
  const MID = L + 270;

  const cell = (x: number, y: number, w: number, h: number, label: string, value: string, o: { right?: boolean; big?: boolean } = {}) => {
    page.drawRectangle({
      x,
      y: y - h,
      width: w,
      height: h,
      borderColor: RULE,
      borderWidth: 0.6,
    });
    text(label, x + 3, y - 8, { size: 6, color: MUTED });
    if (value)
      text(value, o.right ? x + w - 4 : x + 4, y - h + 5, {
        f: bold,
        size: o.big ? 9.5 : 8.5,
        right: o.right,
      });
  };
  const money = (n: number) => (n ? num(n) : '');

  // Two states fit on a W-2. For more, each further pair goes on an extra W-2 that repeats only
  // boxes a-f and the state lines, so federal amounts aren't counted twice (IRS W-2 instructions).
  const allStates = w2.states.length ? w2.states : [{ code: '', wages: 0, tax: 0 }];
  for (let form = 0; form * 2 < allStates.length; form++) {
    if (form > 0) {
      page = pdf.addPage([612, 792]);
      text = writer(page);
    }
    const states = allStates.slice(form * 2, form * 2 + 2);
    const fed = (n: number) => (form === 0 ? money(n) : '');
    COPIES.forEach(([copy, purpose], i) => {
      const top = 772 - i * (H + 16);
      // Left column: a-f.
      cell(L, top, 135, 22, "a  Employee's social security number", employee.ssn);
      cell(L + 135, top, 135, 22, 'OMB No. 1545-0029', '');
      cell(L, top - 22, 270, 22, 'b  Employer identification number (EIN)', company.ein || 'Not on file');
      page.drawRectangle({
        x: L,
        y: top - 100,
        width: 270,
        height: 56,
        borderColor: RULE,
        borderWidth: 0.6,
      });
      text("c  Employer's name, address, and ZIP code", L + 3, top - 52, {
        size: 6,
        color: MUTED,
      });
      [company.name, ...lines(company.address)].slice(0, 4).forEach((l, j) =>
        text(l, L + 4, top - 63 - j * 9.5, {
          f: j ? undefined : bold,
          size: 8,
        }),
      );
      cell(L, top - 100, 270, 20, 'd  Control number', employee.controlNumber);
      page.drawRectangle({
        x: L,
        y: top - 176,
        width: 270,
        height: 56,
        borderColor: RULE,
        borderWidth: 0.6,
      });
      text("e  Employee's name    f  Employee's address and ZIP code", L + 3, top - 128, { size: 6, color: MUTED });
      [employee.name.toUpperCase(), ...lines(employee.address).map((l) => l.toUpperCase())].slice(0, 4).forEach((l, j) =>
        text(l, L + 4, top - 139 - j * 9.5, {
          f: j ? undefined : bold,
          size: 8,
        }),
      );

      // Right columns: boxes 1-14.
      const cw = (W - 270) / 2;
      const pairs: [string, string, string, string][] = [
        ['1  Wages, tips, other compensation', fed(w2.box1), '2  Federal income tax withheld', fed(w2.box2)],
        ['3  Social security wages', fed(w2.box3), '4  Social security tax withheld', fed(w2.box4)],
        ['5  Medicare wages and tips', fed(w2.box5), '6  Medicare tax withheld', fed(w2.box6)],
        ['7  Social security tips', '', '8  Allocated tips', ''],
        ['9', '', '10  Dependent care benefits', ''],
        ['11  Nonqualified plans', '', `12a  Code ${w2.box12[0]?.code ?? ''}`, w2.box12[0] ? fed(w2.box12[0].amount) : ''],
        ['13  Retirement plan', form === 0 && w2.box12.some((b) => b.code === 'D') ? 'X' : '', '14  Other', ''],
      ];
      pairs.forEach(([l1, v1, l2, v2], j) => {
        const y = top - j * 22;
        cell(MID, y, cw, 22, l1, v1, { right: true });
        cell(MID + cw, y, cw, 22, l2, v2, { right: true });
      });
      page.drawRectangle({
        x: MID,
        y: top - 176,
        width: W - 270,
        height: 22,
        color: TINT,
      });
      text(`Form W-2  Wage and Tax Statement  ${w2.year}`, MID + 6, top - 168, {
        f: bold,
        size: 10,
        color: NAVY,
      });

      // State and local: boxes 15-20.
      const sy = top - 176;
      states.forEach((s, j) => {
        const y = sy - j * 20;
        cell(L, y, 80, 20, '15  State  Employer ID', s.code);
        cell(L + 80, y, 95, 20, '16  State wages, tips, etc.', money(s.wages), {
          right: true,
        });
        cell(L + 175, y, 95, 20, '17  State income tax', money(s.tax), {
          right: true,
        });
        cell(MID, y, 95, 20, '18  Local wages, tips, etc.', form === 0 && j === 0 ? money(w2.localWages) : '', { right: true });
        cell(MID + 95, y, 95, 20, '19  Local income tax', form === 0 && j === 0 ? money(w2.local) : '', { right: true });
        cell(MID + 190, y, W - 270 - 190, 20, '20  Locality name', '');
      });
      const fy = sy - states.length * 20 - 10;
      text(`${copy}  ${purpose}`, L, fy, { f: bold, size: 7.5 });
      text('Department of the Treasury - Internal Revenue Service', L + W, fy, {
        size: 7,
        color: MUTED,
        right: true,
      });
    });
  }
  return pdf.save();
}

/**
 * The payroll register for an auditor or accountant: per-employee wages, withholding and
 * deductions, totals, employer taxes, the Form 941 figures and the deposit schedule by month.
 */
export async function renderRegisterPdf(r: Register, company: Company): Promise<Uint8Array> {
  const { pdf, bold, writer } = await setup(`Payroll register ${r.period.label}`, company.name);
  const size: [number, number] = [792, 612]; // landscape
  const L = 30;
  const R = 762;
  let page = pdf.addPage(size);
  let text = writer(page);
  let y = 0;

  const head = (continued = false) => {
    y = 580;
    text(company.name, L, y, { f: bold, size: 12 });
    text(`Payroll register  ${r.period.label}${continued ? ' (continued)' : ''}`, R, y, { f: bold, size: 13, color: NAVY, right: true });
    y -= 13;
    text([company.ein && `FEIN ${company.ein}`, ...lines(company.address)].filter(Boolean).join('   '), L, y, { size: 7.5, color: MUTED });
    text(`Pay dates ${r.period.from} to ${r.period.to}. Processed pay runs only.`, R, y, { size: 7.5, color: MUTED, right: true });
    y -= 22;
  };
  const ensure = (room: number) => {
    if (y - room > 36) return;
    page = pdf.addPage(size);
    text = writer(page);
    head(true);
  };

  head();
  const cols: [string, (row: Register['totals']) => string, number][] = [
    ['Stubs', (x) => String(x.stubs), 200],
    ['Gross', (x) => num(x.gross), 262],
    ['401(k)', (x) => num(x.retirement), 312],
    ['Health', (x) => num(x.health), 360],
    ['Fed wages', (x) => num(x.federalWages), 420],
    ['Fed tax', (x) => num(x.federal), 474],
    ['SS tax', (x) => num(x.socialSecurity), 526],
    ['Medicare', (x) => num(x.medicare), 578],
    ['State tax', (x) => num(x.state), 632],
    ['Other ded.', (x) => num(x.otherDeductions + x.local), 690],
    ['Net pay', (x) => num(x.net), R - 4],
  ];
  const tableHead = () => {
    page.drawRectangle({
      x: L,
      y: y - 4,
      width: R - L,
      height: 15,
      color: TINT,
    });
    text('Employee', L + 4, y, { f: bold, size: 8, color: NAVY });
    cols.forEach(([h, , x]) => text(h, x, y, { f: bold, size: 8, color: NAVY, right: true }));
    y -= 15;
  };
  tableHead();
  if (!r.employees.length) {
    text('No processed pay stubs were paid in this period.', L + 4, y, {
      color: MUTED,
    });
    y -= 14;
  }
  for (const row of r.employees) {
    ensure(14);
    text(row.name, L + 4, y, { size: 8 });
    cols.forEach(([, v, x]) => text(v(row), x, y, { size: 8, right: true }));
    y -= 12;
  }
  page.drawLine({
    start: { x: L, y: y + 8 },
    end: { x: R, y: y + 8 },
    thickness: 0.75,
    color: RULE,
  });
  text('Total', L + 4, y, { f: bold, size: 8 });
  cols.forEach(([, v, x]) => text(v(r.totals), x, y, { f: bold, size: 8, right: true }));
  y -= 28;

  const section = (title: string, rows: [string, string][], x: number, top: number) => {
    let yy = top;
    text(title, x, yy, { f: bold, size: 9, color: NAVY });
    yy -= 13;
    rows.forEach(([k, v]) => {
      text(k, x, yy, { size: 8 });
      text(v, x + 230, yy, { size: 8, right: true });
      yy -= 11;
    });
    return yy;
  };
  ensure(150);
  const f = r.employer.form941;
  const top = y;
  const left = section(
    'Form 941 figures',
    [
      ['Line 2  Wages, tips and other compensation', usd(f.line2)],
      ['Line 3  Federal income tax withheld', usd(f.line3)],
      [`Line 5a SS wages ${num(f.line5a)} x 12.4%`, usd(f.line5aTax)],
      [`Line 5c Medicare ${num(f.line5c)} x 2.9%`, usd(f.line5cTax)],
      [`Line 5d Addl. Medicare ${num(f.line5d)} x 0.9%`, usd(f.line5dTax)],
      ['Line 6  Total taxes before adjustments', usd(f.line6)],
    ],
    L,
    top,
  );
  section(
    'Employer taxes (on top of withholding)',
    [
      ['Employer Social Security (6.2%)', usd(r.employer.socialSecurity)],
      ['Employer Medicare (1.45%)', usd(r.employer.medicare)],
      ['FUTA, 0.6% of first $7,000 a year (Form 940)', usd(r.employer.futa)],
    ],
    L + 255,
    top,
  );
  const right = section('Federal deposits by month (941 line 16)', r.months.length ? r.months.map((m) => [m.month, usd(m.liability)]) : [['None', usd(0)]], L + 510, top);
  y = Math.min(left, right) - 14;
  ensure(30 + r.states.length * 11);
  section('State withholding', r.states.length ? r.states.map((s) => [`${s.code}  wages ${num(s.wages)}`, usd(s.tax)]) : [['None', usd(0)]], L, y);
  text('Figures are computed from pay stubs. Check them against your bank and tax filings before you file. State unemployment (SUTA) depends on your assigned rate and is not included.', L, 30, {
    size: 7,
    color: MUTED,
  });
  return pdf.save();
}
