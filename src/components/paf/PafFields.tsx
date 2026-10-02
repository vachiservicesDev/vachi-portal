import { FieldRow, SelectField, TextAreaField, TextField } from '@/components/ui/fields';
import { Chip } from '@/components/ui/ui';
import { businessDays } from '@/lib/paf/schema';

export interface PafValues {
  lcaCaseNumber: string;
  lcaFilingDate: string;
  worksite: string;
  wageLevel: string | null;
  prevailingWage: string | null;
  actualWage: string | null;
  postingStartDate: string | null;
  postingEndDate: string | null;
}

export const PAF_LABELS = {
  employeeId: 'Employee',
  lcaCaseNumber: 'LCA case number',
  lcaFilingDate: 'LCA filing date',
  worksite: 'Worksite',
  wageLevel: 'Wage level',
  prevailingWage: 'Prevailing wage',
  actualWage: 'Actual wage',
  postingStartDate: 'Posting starts',
  postingEndDate: 'Posting ends',
};

const LEVELS = ['I', 'II', 'III', 'IV'].map((v) => ({ value: v, label: `Level ${v}` }));

/** The LCA and wage fields shared by the create and edit forms. */
export function PafFields({ values, errors }: { values?: PafValues; errors: Record<string, string> }) {
  return (
    <>
      <FieldRow>
        <TextField name="lcaCaseNumber" label="LCA case number" required maxLength={100} placeholder="I-200-12345-123456" defaultValue={values?.lcaCaseNumber} errors={errors} />
        <TextField name="lcaFilingDate" label="LCA filing date" type="date" required defaultValue={values?.lcaFilingDate} errors={errors} />
      </FieldRow>
      <TextAreaField name="worksite" label="Worksite" required rows={2} maxLength={2000} defaultValue={values?.worksite} errors={errors} hint="Full address where the employee works." />
      <FieldRow cols={3}>
        <SelectField name="wageLevel" label="Wage level" placeholder="Not set" options={LEVELS} defaultValue={values?.wageLevel ?? ''} errors={errors} />
        <TextField name="prevailingWage" label="Prevailing wage (USD/yr)" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={values?.prevailingWage} errors={errors} />
        <TextField name="actualWage" label="Actual wage (USD/yr)" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={values?.actualWage} errors={errors} hint="At least the prevailing wage." />
      </FieldRow>
      <FieldRow>
        <TextField name="postingStartDate" label="Notice posted from" type="date" defaultValue={values?.postingStartDate} errors={errors} />
        <TextField name="postingEndDate" label="Notice posted until" type="date" defaultValue={values?.postingEndDate} errors={errors} hint="The notice must stay up 10 business days." />
      </FieldRow>
    </>
  );
}

/** Whether the LCA notice was up for the required 10 business days. */
export function PostingChip({ start, end }: { start: string | null; end: string | null }) {
  if (!start || !end) return <Chip tone="warning">Posting not recorded</Chip>;
  const days = businessDays(start, end);
  return days >= 10 ? <Chip tone="live">{days} business days</Chip> : <Chip tone="danger">Only {days} business days</Chip>;
}
