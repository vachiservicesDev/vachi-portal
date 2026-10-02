'use client';

import type { FieldErrors } from '@/components/ui/fields';
import { FieldRow, Fieldset, SelectField, TextField } from '@/components/ui/fields';
import { VISA_TYPES } from '@/lib/status';

export type EmployeeValues = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  position?: string | null;
  department?: string | null;
  startDate?: string | null;
  visaType?: string;
  visaStartDate?: string | null;
  visaExpiryDate?: string | null;
  status?: string;
};

export const EMPLOYEE_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  phoneNumber: 'Phone',
  position: 'Position',
  department: 'Department',
  startDate: 'Start date',
  visaType: 'Work authorization',
  visaStartDate: 'Valid from',
  visaExpiryDate: 'Valid until',
  status: 'Status',
};

export const OPTIONAL_EMPLOYEE_FIELDS = ['phoneNumber', 'position', 'department', 'startDate', 'visaStartDate', 'visaExpiryDate'] as const;

/** The fields shared by "Add employee" and the employee's edit form. */
export function EmployeeFields({ values = {}, errors, emailLocked }: { values?: EmployeeValues; errors?: FieldErrors; emailLocked?: boolean }) {
  return (
    <div className="grid gap-8">
      <Fieldset legend="Person">
        <FieldRow>
          <TextField name="firstName" label="First name" required autoComplete="off" defaultValue={values.firstName} errors={errors} maxLength={100} />
          <TextField name="lastName" label="Last name" required defaultValue={values.lastName} errors={errors} maxLength={100} />
        </FieldRow>
        <FieldRow>
          <TextField
            name="email"
            label="Work email"
            type="email"
            required
            inputMode="email"
            defaultValue={values.email}
            errors={errors}
            readOnly={emailLocked}
            hint={emailLocked ? 'Tied to their portal login, so it can’t be changed here.' : 'Their portal invite goes to this address.'}
          />
          <TextField name="phoneNumber" label="Phone" type="tel" inputMode="tel" defaultValue={values.phoneNumber} errors={errors} maxLength={20} />
        </FieldRow>
      </Fieldset>
      <Fieldset legend="Job">
        <FieldRow cols={3}>
          <TextField name="position" label="Position" defaultValue={values.position} errors={errors} maxLength={100} />
          <TextField name="department" label="Department" defaultValue={values.department} errors={errors} maxLength={100} />
          <TextField name="startDate" label="Start date" type="date" defaultValue={values.startDate} errors={errors} />
        </FieldRow>
        <SelectField
          name="status"
          label="Status"
          required
          className="sm:max-w-xs"
          defaultValue={values.status ?? 'active'}
          errors={errors}
          hint="Inactive employees can't sign in to the portal."
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending start' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </Fieldset>
      <Fieldset legend="Work authorization">
        <FieldRow cols={3}>
          <SelectField name="visaType" label="Type" required defaultValue={values.visaType ?? 'Other'} errors={errors} options={VISA_TYPES} />
          <TextField name="visaStartDate" label="Valid from" type="date" defaultValue={values.visaStartDate} errors={errors} />
          <TextField
            name="visaExpiryDate"
            label="Valid until"
            type="date"
            defaultValue={values.visaExpiryDate}
            errors={errors}
            hint="Drives the visa expiration tracker."
          />
        </FieldRow>
      </Fieldset>
    </div>
  );
}
