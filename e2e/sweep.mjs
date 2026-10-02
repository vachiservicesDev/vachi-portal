// Responsive sweep: every page, both roles, phone/tablet/laptop/wide. Flags sideways scroll,
// content poking out of the viewport, tiny tap targets and console errors; saves screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const EMP = JSON.parse(fs.readFileSync(new URL('./last-employee.json', import.meta.url), 'utf8'));
const SIZES = { phone: { width: 375, height: 812 }, tablet: { width: 820, height: 1180 }, laptop: { width: 1280, height: 800 }, wide: { width: 1920, height: 1080 } };
fs.mkdirSync(new URL('./sweep', import.meta.url), { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const problems = [];

async function login(email, pass) {
  const ctx = await browser.newContext({ viewport: SIZES.laptop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(pass);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  return page;
}

async function firstHref(page, path, prefix) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const hrefs = await page.locator(`main a[href^="${prefix}"]`).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  return hrefs.find((h) => /[0-9a-f-]{36}$/.test(h)) ?? null;
}

async function sweep(page, role, paths) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|RSC payload|status of 404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const path of paths) {
    for (const [size, vp] of Object.entries(SIZES)) {
      await page.setViewportSize(vp);
      errors.length = 0;
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const report = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out = { scroll: document.documentElement.scrollWidth > vw + 1, poking: [], small: [] };
        for (const el of document.querySelectorAll('main *, header *')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || el.closest('.sr-only, [aria-hidden=true]')) continue;
          // Ignore things inside a scroll container (e.g. the chat log).
          let p = el.parentElement, scrolls = false;
          while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scrolls = true; break; } p = p.parentElement; }
          if (!scrolls && (r.right > vw + 1 || r.left < -1)) out.poking.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} (${Math.round(r.left)}–${Math.round(r.right)})`);
          if (el.matches('a, button, input, select, textarea, summary') && !el.closest('p, li > p, dd') && (r.height < 24 || r.width < 24)) out.small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        out.poking = [...new Set(out.poking)].slice(0, 5);
        out.small = [...new Set(out.small)].slice(0, 5);
        return out;
      });
      const name = `${role}${path.replace(/\/[0-9a-f-]{36}/g, '/id').replace(/\W+/g, '_')}_${size}.png`;
      await page.screenshot({ path: new URL(`./sweep/${name}`, import.meta.url).pathname, fullPage: true });
      const issues = [];
      if (report.scroll) issues.push('sideways scroll');
      if (report.poking.length) issues.push('off-screen: ' + report.poking.join(', '));
      if (report.small.length) issues.push('small targets: ' + report.small.join(', '));
      if (errors.length) issues.push('console: ' + errors.slice(0, 3).join(' | '));
      if (issues.length) problems.push(`${role} ${path} @${size}: ${issues.join('; ')}`);
    }
    process.stdout.write('.');
  }
}

const admin = await login(process.env.EMAIL, process.env.PASS);
const ids = {};
for (const [k, path, prefix] of [
  ['emp', '/admin/employees', '/admin/employees/'],
  ['ts', '/admin/timesheets', '/admin/timesheets/'],
  ['i9', '/admin/i9', '/admin/i9/'],
  ['onb', '/admin/onboarding', '/admin/onboarding/'],
  ['task', '/admin/training', '/admin/training/'],
  ['gc', '/admin/green-card', '/admin/green-card/'],
  ['stem', '/admin/stem-opt', '/admin/stem-opt/'],
  ['paf', '/admin/paf', '/admin/paf/'],
]) ids[k] = await firstHref(admin, path, prefix);
const adminPaths = ['/admin', '/admin/employees', '/admin/employees/new', '/admin/onboarding', '/admin/i9', '/admin/immigration', '/admin/stem-opt', '/admin/paf', '/admin/green-card', '/admin/timesheets', '/admin/payroll', '/admin/training', '/admin/training/summaries', '/admin/reviews', '/messages', '/notifications', '/admin/audit-log', ...Object.values(ids).filter((h) => h && !h.endsWith('/new') && !h.endsWith('/summaries'))];
await sweep(admin, 'admin', adminPaths);

const emp = await login(EMP.email, EMP.pass);
const empIds = [await firstHref(emp, '/timesheets', '/timesheets/'), await firstHref(emp, '/training', '/training/'), await firstHref(emp, '/messages', '/messages/')].filter((h) => h && !h.endsWith('/summaries'));
await sweep(emp, 'employee', ['/dashboard', '/onboarding', '/i9', '/timesheets', '/payroll', '/training', '/training/summaries', '/reviews', '/stem-opt', '/green-card', '/messages', '/notifications', ...empIds]);

const anon = await (await browser.newContext()).newPage();
await sweep(anon, 'public', ['/login', '/forgot-password', '/set-password']);

await browser.close();
console.log(`\n${problems.length ? problems.join('\n') : 'No layout problems found.'}`);
