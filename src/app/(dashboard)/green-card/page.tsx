'use client';

import { useResource } from '@/lib/client/api';
import { statusOf } from '@/lib/status';
import { StageTracker } from '@/components/immigration/StageTracker';
import { Alert, Chip, DetailList, EmptyState, Loading, PageHeader, Panel, When } from '@/components/ui/ui';

interface GcCase {
  stage: string;
  priorityDate: string | null;
  stageUpdatedAt: string;
}

export default function GreenCardPage() {
  const { data, error, loading } = useResource<{ case: GcCase | null }>('/api/green-card/me');
  const gc = data?.case;

  return (
    <>
      <PageHeader eyebrow="Immigration" title="Green card" lead="Where your sponsorship stands. HR updates this as each filing moves forward." />
      {error && <Alert title="Couldn't load your case">{error}</Alert>}
      {loading && !data ? (
        <Loading />
      ) : !gc ? (
        <EmptyState title="No sponsorship case on file">If you expected one, message HR.</EmptyState>
      ) : (
        <Panel title="Your case" actions={<Chip tone={statusOf('greenCard', gc.stage).tone}>{statusOf('greenCard', gc.stage).label}</Chip>}>
          <StageTracker stage={gc.stage} />
          <div className="mt-8 border-t border-line pt-6">
            <DetailList
              items={[
                { label: 'Priority date', value: gc.priorityDate ? <When iso={gc.priorityDate} /> : 'Not set yet' },
                { label: 'Stage last changed', value: <When iso={gc.stageUpdatedAt} /> },
              ]}
            />
          </div>
        </Panel>
      )}
    </>
  );
}
