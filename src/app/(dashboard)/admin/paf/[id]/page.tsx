'use client';

import { useParams } from 'next/navigation';
import { useAction, useResource } from '@/lib/client/api';
import { fullName } from '@/lib/status';
import { PAF_LABELS, PafFields, PostingChip, type PafValues } from '@/components/paf/PafFields';
import { Button } from '@/components/ui/Button';
import { FormStatus } from '@/components/ui/forms';
import { Alert, DateRange, DetailList, Loading, PageHeader, Panel, When, formatMoney } from '@/components/ui/ui';

interface PafFile extends PafValues {
  id: string;
  updatedAt: string;
  employeeFirstName: string;
  employeeLastName: string;
}

export default function AdminPafDetailPage() {
  const params = useParams<{ id: string }>();
  const url = `/api/paf/${params.id}`;
  const { data, error, loading, reload } = useResource<{ file: PafFile }>(url);
  const action = useAction();
  const file = data?.file;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v.trim()) body[k] = v.trim();
    });
    const result = await action.run('save', url, { method: 'PATCH', body }, 'File updated.');
    if (result.ok) reload();
  }

  const back = { href: '/admin/paf', label: 'All public access files' };
  if (loading && !data) return <Loading />;
  if (!file)
    return (
      <>
        <PageHeader back={back} title="Public access file" />
        <Alert title="Couldn't load this file">{error}</Alert>
      </>
    );

  return (
    <>
      <PageHeader back={back} eyebrow={`LCA ${file.lcaCaseNumber}`} title={fullName(file.employeeFirstName, file.employeeLastName)} actions={<PostingChip start={file.postingStartDate} end={file.postingEndDate} />} />
      <div className="grid gap-8">
        <Panel title="Summary">
          <DetailList
            columns={3}
            items={[
              { label: 'Filed', value: <When iso={file.lcaFilingDate} /> },
              { label: 'Wage level', value: file.wageLevel ? `Level ${file.wageLevel}` : null },
              { label: 'Notice posted', value: file.postingStartDate ? <DateRange from={file.postingStartDate} to={file.postingEndDate} /> : null },
              { label: 'Prevailing wage', value: file.prevailingWage ? `${formatMoney(file.prevailingWage)} / yr` : null },
              { label: 'Actual wage', value: file.actualWage ? `${formatMoney(file.actualWage)} / yr` : null },
              { label: 'Worksite', value: <span className="whitespace-pre-wrap">{file.worksite}</span> },
            ]}
          />
        </Panel>
        <Panel title="Edit">
          <form key={file.updatedAt} onSubmit={save} noValidate className="grid gap-5">
            <FormStatus error={action.error} success={action.success} fieldErrors={action.fieldErrors} labels={PAF_LABELS} />
            <PafFields values={file} errors={action.fieldErrors} />
            <div>
              <Button type="submit" busy={action.busy === 'save'} busyLabel="Saving…">
                Save changes
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
