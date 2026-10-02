// End-to-end QA: HR and a brand-new employee click through every workflow in a real browser.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
const ADMIN = { email: process.env.EMAIL, pass: process.env.PASS };
if (!ADMIN.email || !ADMIN.pass) throw new Error('Set EMAIL and PASS to a local admin login.');
const stamp = Date.now().toString(36);
const EMP = { first: 'Qa', last: `Tester ${stamp}`, email: `qa.${stamp}@example.com`, pass: 'Employee-Test-2026!' };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const results = [];
const errors = [];

async function newPage(label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 4\d\d|Failed to fetch RSC payload/.test(m.text())) errors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] ${e}`));
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`[${label}] ${r.status()} ${r.url()}`); });
  return page;
}

async function step(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
    console.log('PASS', name);
  } catch (e) {
    results.push(['FAIL', name, String(e).split('\n')[0]]);
    console.log('FAIL', name, '\n   ', String(e).split('\n').slice(0, 3).join('\n    '));
  }
}

const expectText = async (page, text, timeout = 10000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });
const go = (page, path) => page.goto(BASE + path, { waitUntil: 'networkidle' });
const ok = async (page, re) => expectText(page, re);
async function choose(select, text) {
  await select.locator('option', { hasText: text }).first().waitFor({ state: 'attached', timeout: 15000 });
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value);
}

const admin = await newPage('admin');
const emp = await newPage('employee');

await step('HR signs in', async () => {
  await go(admin, '/login');
  await admin.getByLabel('Work email').fill(ADMIN.email);
  await admin.getByLabel('Password').fill(ADMIN.pass);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.waitForURL('**/admin', { timeout: 20000 });
});

let employeeUrl = '';
await step('HR adds an employee', async () => {
  await go(admin, '/admin/employees/new');
  await admin.getByLabel(/^First name/).fill(EMP.first);
  await admin.getByLabel(/^Last name/).fill(EMP.last);
  await admin.getByLabel(/^Work email/).fill(EMP.email);
  await admin.getByLabel(/^Position/).fill('QA Engineer');
  await admin.getByLabel(/^Department/).fill('Engineering');
  await admin.getByLabel(/^Start date/).fill('2026-01-05');
  await admin.getByLabel(/^Type/).selectOption('STEM_OPT');
  await admin.getByLabel(/^Valid until/).fill('2026-11-15');
  await admin.getByRole('button', { name: 'Save employee' }).click();
  await admin.waitForURL(/\/admin\/employees\/[0-9a-f-]{36}/, { timeout: 15000 });
  employeeUrl = admin.url();
  await ok(admin, EMP.email);
});

let inviteLink = '';
await step('HR creates an invite link', async () => {
  const resp = admin.waitForResponse((r) => r.url().endsWith('/invite') && r.request().method() === 'POST');
  await admin.getByRole('button', { name: 'Create invite link instead' }).click();
  const body = await (await resp).json();
  if (!body.link) throw new Error('no link in response: ' + JSON.stringify(body));
  inviteLink = body.link;
  await admin.locator('#invite-link').waitFor();
});

await step('Employee opens the invite and sets a password', async () => {
  await emp.goto(inviteLink, { waitUntil: 'networkidle' });
  await emp.waitForURL('**/set-password**', { timeout: 20000 });
  await emp.getByLabel(/^New password/).fill(EMP.pass);
  await emp.getByLabel(/^Confirm new password/).fill(EMP.pass);
  await emp.getByRole('button', { name: /password/i }).click();
  await emp.waitForURL((u) => u.pathname === '/dashboard', { timeout: 20000 });
  await ok(emp, EMP.first);
});

await step('Employee signs out and back in with the new password', async () => {
  await emp.getByRole('button', { name: 'Sign out' }).click();
  await emp.waitForURL('**/login**');
  await emp.getByLabel('Work email').fill(EMP.email);
  await emp.getByLabel('Password').fill(EMP.pass);
  await emp.getByRole('button', { name: 'Sign in' }).click();
  await emp.waitForURL((u) => u.pathname === '/dashboard', { timeout: 20000 });
});

await step('Employee is kept out of HR pages', async () => {
  await go(emp, '/admin/employees');
  if (emp.url().includes('/admin/employees')) {
    const body = await emp.textContent('main');
    if (body.includes(EMP.email)) throw new Error('employee can see the HR employee list');
  }
});

// ---- Timesheets
let timesheetUrl = '';
await step('Employee starts a timesheet, logs hours and submits', async () => {
  await go(emp, '/timesheets');
  await emp.getByLabel(/^Week starting/).fill('2026-02-02');
  await emp.getByLabel(/^Week ending/).fill('2026-02-08');
  await emp.getByRole('button', { name: 'Start timesheet' }).click();
  await emp.waitForURL(/\/timesheets\/[0-9a-f-]{36}/, { timeout: 15000 });
  timesheetUrl = emp.url();
  for (const [d, h] of [['2026-02-02', '8'], ['2026-02-03', '7.5']]) {
    await emp.getByLabel(/^Date/).fill(d);
    await emp.getByLabel(/^Hours/).fill(h);
    await emp.getByLabel(/^What did you work on/).fill('Portal QA');
    await emp.getByRole('button', { name: 'Add hours' }).click();
    await emp.waitForResponse((r) => r.url().includes('/entries') && r.request().method() === 'POST');
  }
  await ok(emp, '15.5');
  await emp.getByRole('button', { name: 'Submit week for approval' }).click();
  await ok(emp, 'Awaiting approval');
});

await step('HR returns the timesheet with a note', async () => {
  await go(admin, '/admin/timesheets');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).first().click();
  await admin.getByLabel(/^Note to the employee/).fill('Please add Wednesday');
  await admin.getByRole('button', { name: 'Return for changes' }).click();
  await ok(admin, 'Returned');
});

await step('Employee fixes and resubmits; HR approves', async () => {
  await emp.goto(timesheetUrl, { waitUntil: 'networkidle' });
  await ok(emp, 'Please add Wednesday');
  await emp.getByLabel(/^Date/).fill('2026-02-04');
  await emp.getByLabel(/^Hours/).fill('8');
  await emp.getByRole('button', { name: 'Add hours' }).click();
  await ok(emp, '23.5');
  await emp.getByRole('button', { name: 'Submit week for approval' }).click();
  await ok(emp, 'Awaiting approval');
  await go(admin, '/admin/timesheets');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).first().click();
  await admin.getByRole('button', { name: 'Approve timesheet' }).click();
  await ok(admin, 'Approved');
});

// ---- Training
let taskUrl = '';
await step('HR creates training and assigns the employee', async () => {
  await go(admin, '/admin/training');
  await admin.getByLabel(/^Title/).fill(`Security basics ${stamp}`);
  await admin.getByLabel(/^Description/).fill('Phishing, passwords and MFA.');
  await admin.getByLabel(/^Priority/).selectOption('high');
  await admin.getByLabel(/^Due date/).fill('2026-12-31');
  await admin.getByLabel(/^Link to material/).fill('https://example.com/security');
  await admin.getByLabel('Required for everyone assigned').check();
  await admin.getByRole('button', { name: 'Create training' }).click();
  await ok(admin, 'Training created');
  await admin.getByRole('link', { name: `Security basics ${stamp}` }).click();
  await admin.waitForURL(/\/admin\/training\/[0-9a-f-]{36}/);
  taskUrl = admin.url();
  await admin.getByRole('checkbox', { name: new RegExp(`${EMP.first} ${EMP.last}`) }).check();
  await admin.getByRole('button', { name: /Assign to 1 person/ }).click();
  await ok(admin, 'Assigned to 1 person');
});

await step('Employee starts the training, comments and completes it', async () => {
  await go(emp, '/training');
  await emp.getByRole('link', { name: `Security basics ${stamp}` }).click();
  await emp.getByRole('button', { name: 'Start training' }).click();
  await ok(emp, 'Started');
  await emp.getByLabel('Add a comment').fill('Is module 2 required?');
  await emp.getByRole('button', { name: 'Post comment' }).click();
  await ok(emp, 'Is module 2 required?');
  await emp.getByRole('button', { name: 'Mark complete' }).click();
  await ok(emp, 'Marked complete');
});

await step('HR sees the comment and records a score', async () => {
  await admin.goto(taskUrl, { waitUntil: 'networkidle' });
  await ok(admin, '1 of 1 assigned have completed it');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).click();
  await ok(admin, 'Is module 2 required?');
  await admin.getByLabel(/^Score/).fill('92');
  await admin.getByRole('button', { name: 'Save result' }).click();
  await ok(admin, '92 / 100');
});

// ---- Weekly summaries
await step('Employee submits a weekly summary; HR returns it; employee resubmits; HR approves', async () => {
  await go(emp, '/training/summaries');
  await emp.getByLabel(/^Week starts/).fill('2026-02-02');
  await emp.getByLabel(/^Week ends/).fill('2026-02-06');
  await emp.locator('#f-content').fill('Finished security basics.');
  await emp.getByRole('button', { name: 'Submit for review' }).click();
  await ok(emp, 'Summary submitted');
  await go(admin, '/admin/training/summaries');
  const card = admin.locator('li', { hasText: `${EMP.first} ${EMP.last}` }).first();
  await card.getByLabel('Comments for the employee').fill('Add one thing you learned.');
  await card.getByRole('button', { name: 'Return for changes' }).click();
  await admin.locator('li', { hasText: 'Add one thing you learned.' }).first().waitFor();
  await go(emp, '/training/summaries');
  await ok(emp, 'Add one thing you learned.');
  await emp.getByRole('button', { name: 'Fix and resubmit' }).click();
  await emp.locator('textarea[id^="edit-"]').fill('Finished security basics. Learned to spot spoofed sender domains.');
  await emp.locator('li').getByRole('button', { name: 'Submit for review' }).click();
  await ok(emp, 'spoofed sender domains');
  await go(admin, '/admin/training/summaries');
  await admin.locator('li', { hasText: `${EMP.first} ${EMP.last}` }).first().getByRole('button', { name: 'Approve' }).click();
  await admin.getByRole('heading', { name: 'Reviewed' }).waitFor();
});

// ---- Performance review
await step('HR writes and shares a review; employee acknowledges it', async () => {
  await go(admin, '/admin/reviews');
  await admin.getByLabel(/^Employee/).selectOption({ label: `${EMP.first} ${EMP.last}` });
  await admin.getByLabel(/^Period starts/).fill('2026-01-01');
  await admin.getByLabel(/^Period ends/).fill('2026-06-30');
  await admin.locator('#new-rating').selectOption('4');
  await admin.locator('#new-strengths').fill('Thorough testing.');
  await admin.locator('#new-goals').fill('Own the release checklist.');
  await admin.getByRole('button', { name: 'Save and share now' }).click();
  await ok(admin, 'Review shared');
  await go(emp, '/reviews');
  await ok(emp, 'Thorough testing.');
  await emp.getByRole('button', { name: /read this review/ }).click();
  await ok(emp, 'You acknowledged this review');
  await go(admin, '/admin/reviews');
  await ok(admin, 'acknowledged');
});

// ---- Payroll
await step('HR records a pay run and stub; employee sees it', async () => {
  await go(admin, '/admin/payroll');
  const y = 2030 + (Date.now() % 60);
  await admin.getByLabel(/^Period starts/).fill(`${y}-02-01`);
  await admin.getByLabel(/^Period ends/).fill(`${y}-02-15`);
  await admin.getByLabel(/^Pay date/).fill(`${y}-02-20`);
  await admin.getByRole('button', { name: 'Record pay run' }).click();
  await ok(admin, 'Pay run recorded');
  await admin.getByLabel(/^Employee/).selectOption({ label: `${EMP.first} ${EMP.last}` });
  await admin.getByLabel(/^Gross pay/).fill('4200');
  await admin.getByLabel(/^Net pay/).fill('4300');
  await admin.getByRole('button', { name: 'Add pay stub' }).click();
  await ok(admin, 'more than gross pay');
  await admin.getByLabel(/^Net pay/).fill('3150.25');
  await admin.getByRole('button', { name: 'Add pay stub' }).click();
  await ok(admin, 'Pay stub added');
  await admin.getByRole('button', { name: 'Mark processed' }).click();
  await ok(admin, 'processed and locked');
  if (await admin.getByRole('button', { name: 'Add pay stub' }).count()) throw new Error('stub form still shown on a processed run');
  await go(emp, '/payroll');
  await ok(emp, '$3,150.25');
});

// ---- Immigration
await step('HR starts a green card case and moves it forward; employee sees the stage', async () => {
  await go(admin, '/admin/green-card');
  await admin.getByLabel(/^Employee/).selectOption({ label: `${EMP.first} ${EMP.last}` });
  await admin.getByRole('button', { name: 'Start case' }).click();
  await ok(admin, 'Case started');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).click();
  await admin.getByLabel(/^Stage/).selectOption('i140_filed');
  await admin.getByLabel(/^Priority date/).fill('2026-03-01');
  await admin.getByLabel(/^Internal notes/).fill('HR-only note');
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await ok(admin, 'Case updated');
  await go(emp, '/green-card');
  await ok(emp, 'I-140 filed');
  if ((await emp.textContent('main')).includes('HR-only note')) throw new Error('employee can see HR notes');
});

await step('HR creates a STEM OPT plan and records an evaluation; employee sees it', async () => {
  await go(admin, '/admin/stem-opt');
  await admin.getByLabel(/^Employee/).selectOption({ label: `${EMP.first} ${EMP.last} (STEM OPT)` });
  await admin.getByLabel(/^Training starts/).fill('2026-01-05');
  await admin.getByLabel(/^Training ends/).fill('2028-02-01');
  await admin.getByRole('button', { name: 'Create plan' }).click();
  await ok(admin, '24 months');
  await admin.getByLabel(/^Training ends/).fill('2028-01-05');
  await admin.getByRole('button', { name: 'Create plan' }).click();
  await ok(admin, 'Plan created');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).click();
  await admin.getByRole('button', { name: 'Mark complete' }).first().click();
  await ok(admin, '12-month evaluation marked complete');
  await go(emp, '/stem-opt');
  await ok(emp, 'Done');
});

await step('HR files an H-1B public access file, wage rule enforced, then edits it', async () => {
  await go(admin, '/admin/paf');
  await admin.getByLabel(/^Employee/).selectOption({ label: `${EMP.first} ${EMP.last}` });
  await admin.getByLabel(/^LCA case number/).fill(`I-200-26${stamp.slice(-3)}-000001`);
  await admin.getByLabel(/^LCA filing date/).fill('2026-02-16');
  await admin.getByLabel(/^Worksite/).fill('100 Congress Ave, Austin, TX 78701');
  await admin.getByLabel(/^Prevailing wage/).fill('120000');
  await admin.getByLabel(/^Actual wage/).fill('110000');
  await admin.getByRole('button', { name: 'Add file' }).click();
  await ok(admin, 'at least the prevailing wage');
  await admin.getByLabel(/^Actual wage/).fill('125000');
  await admin.getByLabel(/^Notice posted from/).fill('2026-02-02');
  await admin.getByLabel(/^Notice posted until/).fill('2026-02-13');
  await admin.getByRole('button', { name: 'Add file' }).click();
  await ok(admin, 'Public access file created');
  await ok(admin, '10 business days');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).first().click();
  await admin.waitForURL(/\/admin\/paf\/[0-9a-f-]{36}/);
  await admin.getByRole('heading', { name: 'Summary' }).waitFor();
  await admin.getByLabel(/^Wage level/).selectOption('II');
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await ok(admin, 'File updated');
  await ok(admin, 'Level II');
});

await step('Visa expirations shows the employee as needing planning', async () => {
  await go(admin, '/admin/immigration');
  const row = admin.locator('tr', { hasText: `${EMP.first} ${EMP.last}` });
  await row.waitFor();
  const text = await row.textContent();
  if (!/days left/.test(text)) throw new Error('no countdown: ' + text);
});

// ---- I-9
await step('Form I-9: HR starts it, employee signs Section 1, HR completes Section 2 and E-Verify', async () => {
  await go(admin, '/admin/i9');
  await choose(admin.getByLabel(/^Employee/), `${EMP.first} ${EMP.last}`);
  await admin.getByRole('button', { name: 'Start Form I-9' }).click();
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).first().waitFor();
  await go(emp, '/i9');
  await emp.getByLabel(/^Legal first name/).fill('Qa');
  await emp.getByLabel(/^Legal last name/).fill('Tester');
  await emp.getByLabel(/^Home address/).fill('1 Test Way, Austin, TX 78701');
  await emp.getByLabel(/^Date of birth/).fill('1995-05-05');
  const citizenship = emp.getByLabel(/I attest, under penalty of perjury/);
  if (await citizenship.count()) await citizenship.first().selectOption('us_citizen').catch(async () => emp.getByLabel(/citizen of the United States/i).check());
  else await emp.getByLabel(/citizen of the United States/i).check();
  await emp.getByLabel(/^Type your full legal name to sign/).fill('Qa Tester');
  await emp.getByRole('button', { name: 'Sign and submit Section 1' }).click();
  await ok(emp, /Section 1|submitted|signed/i);
  await go(admin, '/admin/i9');
  await admin.getByRole('link', { name: `${EMP.first} ${EMP.last}` }).first().click();
  await admin.getByLabel(/^Document title/).first().fill('U.S. Passport');
  await admin.getByLabel(/^Issuing authority/).first().fill('U.S. Department of State');
  await admin.getByLabel(/^Document number/).first().fill('X1234567');
  await admin.getByLabel(/^Expiration date/).first().fill('2032-01-01');
  await admin.getByLabel(/^First day of employment/).fill('2026-01-05');
  await admin.getByRole('button', { name: 'Complete Section 2' }).click();
  await ok(admin, 'Complete');
  await admin.getByLabel(/^Case number/).fill(`2026${stamp}`);
  const result = admin.getByLabel(/^Case result/);
  if (await result.count()) await result.selectOption('employment_authorized');
  await admin.getByRole('button', { name: /Record case|Update case/ }).click();
  await ok(admin, 'Employment authorized');
});

// ---- Messages and notifications
await step('Employee messages HR; HR sees it unread and replies; employee gets the reply', async () => {
  await go(emp, '/messages');
  await emp.locator('a[href^="/messages/"]').first().click();
  await emp.getByLabel(/^Message /).fill(`Hello HR ${stamp}`);
  await emp.keyboard.press('Enter');
  await ok(emp, `Hello HR ${stamp}`);
  await go(admin, '/messages');
  const row = admin.locator('a', { hasText: `${EMP.first} ${EMP.last}` });
  await row.waitFor();
  if (!/unread/.test(await row.textContent())) throw new Error('no unread badge for HR');
  await row.click();
  await ok(admin, `Hello HR ${stamp}`);
  await admin.getByLabel(/^Message /).fill('Hi! Happy to help.');
  await admin.getByRole('button', { name: 'Send' }).click();
  await ok(admin, 'Hi! Happy to help.');
  await expectText(emp, 'Hi! Happy to help.', 30000);
});

await step('Employee sees notifications for each event and clears them', async () => {
  await go(emp, '/notifications');
  for (const t of ['New training assigned', 'Weekly summary returned', 'New performance review']) await ok(emp, t);
  await emp.getByRole('button', { name: 'Mark all as read' }).click();
  await ok(emp, 'all caught up');
  await emp.waitForFunction(() => !/unread/.test(document.querySelector('header a[href="/notifications"]')?.getAttribute('aria-label') ?? ''), null, { timeout: 10000 });
});

await step('HR dashboard and audit log reflect the work', async () => {
  await go(admin, '/admin');
  await go(admin, '/admin/audit-log');
  await ok(admin, /Green card stage changed|Paf updated/);
});

import('node:fs').then((fs) => fs.writeFileSync(new URL('./last-employee.json', import.meta.url), JSON.stringify(EMP)));
await browser.close();
const failed = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (errors.length) console.log('Console/server errors:\n  ' + [...new Set(errors)].slice(0, 30).join('\n  '));
process.exit(failed.length ? 1 : 0);
