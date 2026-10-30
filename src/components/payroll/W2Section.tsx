'use client';

import { useState } from 'react';
import { useAction, useResource } from '@/lib/client/api';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/fields';
import { FormStatus } from '@/components/ui/forms';
import { Alert, Chip, DataTable, Panel, formatMoney } from '@/components/ui/ui';
import type { W2 } from '@/lib/payroll/totals';

/** The employee's W-2 for each year they were paid, downloadable once they agree to electronic delivery. */
export function W2Section() {
  const { data, error, reload } = useResource<{
    consentAt: string | null;
    currentYear: number;
    w2s: W2[];
  }>('/api/me/w2');
  const action = useAction();
  const [agree, setAgree] = useState(false);

  async function consent(e: React.FormEvent) {
    e.preventDefault();
    const result = await action.run('consent', '/api/me/w2', { body: { consent: true } }, 'Thanks. Your W-2s are ready to download.');
    if (result.ok) await reload();
  }

  if (error) return <Alert title="Couldn't load your W-2s">{error}</Alert>;
  if (!data || data.w2s.length === 0) return null;
  return (
    <Panel
      id="w2"
      title="Form W-2"
      description="Your yearly Wage and Tax Statement, built from your processed pay stubs. Use it to file your federal and state tax returns. A W-2 is final once the year has ended."
    >
      <div className="grid gap-5">
        <FormStatus error={action.error} success={action.success} />
        {!data.consentAt && (
          <form onSubmit={consent} className="grid gap-3 rounded-lg border border-line p-4" noValidate>
            <CheckboxField
              name="consent"
              label="I agree to receive my Form W-2 electronically instead of on paper. I can withdraw this by messaging HR, and ask for a paper copy at any time."
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <div>
              <Button type="submit" busy={action.busy === 'consent'} busyLabel="Saving" disabled={!agree}>
                Agree and show my W-2s
              </Button>
            </div>
          </form>
        )}
        <DataTable
          caption="Your W-2s"
          rows={data.w2s}
          rowKey={(w) => String(w.year)}
          columns={[
            {
              header: 'Tax year',
              primary: true,
              cell: (w) => (
                <span className="inline-flex items-center gap-2">
                  {w.year} {w.year >= data.currentYear && <Chip tone="draft">Year in progress</Chip>}
                </span>
              ),
            },
            {
              header: 'Wages (box 1)',
              align: 'right',
              cell: (w) => formatMoney(w.box1),
            },
            {
              header: 'Federal tax (box 2)',
              align: 'right',
              cell: (w) => formatMoney(w.box2),
            },
            {
              header: 'State tax (box 17)',
              align: 'right',
              cell: (w) => formatMoney(w.states.reduce((s, x) => s + x.tax, 0)),
            },
            {
              header: 'Download',
              align: 'right',
              cell: (w) =>
                data.consentAt ? (
                  <a href={`/api/me/w2/${w.year}/pdf`} className="text-sm font-medium text-navy-700 underline">
                    W-2 PDF
                  </a>
                ) : (
                  <span className="text-sm text-muted">Agree above first</span>
                ),
            },
          ]}
        />
      </div>
    </Panel>
  );
}
