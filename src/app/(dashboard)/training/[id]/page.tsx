'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Assignment {
  id: string;
  status: string;
  score: number | null;
}

interface Task {
  title: string;
  description: string | null;
  contentUrl: string | null;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
}

export default function TrainingAssignmentPage() {
  const params = useParams<{ id: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [aRes, cRes] = await Promise.all([
      fetch(`/api/training/assignments/${params.id}`),
      fetch(`/api/training/assignments/${params.id}/comments`),
    ]);
    if (aRes.ok) {
      const data = await aRes.json();
      setAssignment(data.assignment);
      setTask(data.task);
    }
    if (cRes.ok) setComments((await cRes.json()).comments);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load closes over params.id only
  }, [params.id]);

  async function updateStatus(status: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/training/assignments/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).message ?? 'Failed to update');
      return;
    }
    load();
  }

  async function postComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/training/assignments/${params.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment }),
    });
    setBusy(false);
    if (res.ok) {
      setNewComment('');
      load();
    }
  }

  if (!assignment || !task) return <p className="p-12 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{task.title}</h1>
      {task.description && <p className="mt-2 text-sm text-gray-600">{task.description}</p>}
      {task.contentUrl && (
        <a href={task.contentUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-indigo-600 hover:underline">
          Open training material →
        </a>
      )}

      <p className="mt-4 text-sm text-gray-500">status: {assignment.status}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        {assignment.status === 'assigned' && (
          <button onClick={() => updateStatus('in_progress')} disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Start
          </button>
        )}
        {assignment.status === 'in_progress' && (
          <button onClick={() => updateStatus('completed')} disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Mark complete
          </button>
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-medium">Comments</h2>
        <ul className="mt-2 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-gray-200 p-3 text-sm">
              {c.body}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={postComment} disabled={busy} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Post
          </button>
        </div>
      </section>
    </div>
  );
}
