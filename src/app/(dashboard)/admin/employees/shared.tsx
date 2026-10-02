import { Chip } from '@/components/ui/ui';

export interface EmployeeRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  startDate: string | null;
  position: string | null;
  department: string | null;
  status: string;
  visaType: string;
  visaExpiryDate: string | null;
  userId: string | null;
  role: string | null;
  profileActive: boolean | null;
}

export function AccessChip({ row }: { row: Pick<EmployeeRow, 'userId' | 'role' | 'profileActive'> }) {
  if (!row.userId) return <Chip tone="draft">No login yet</Chip>;
  if (row.profileActive === false) return <Chip tone="muted">Login disabled</Chip>;
  return row.role === 'admin' ? <Chip tone="info">Admin</Chip> : <Chip tone="live">Has login</Chip>;
}
