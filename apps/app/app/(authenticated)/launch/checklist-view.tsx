'use client';

import { CheckIcon, CopyIcon, ExternalLinkIcon, UndoIcon } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import {
  LAUNCH_TASKS,
  type LaunchOwner,
  type LaunchTask,
  OWNER_LABELS,
} from '../../../lib/launch-checklist';
import { type LaunchTaskState, toggleLaunchTask } from './actions';

/**
 * The launch board, built for one job: always show each person their ONE
 * next doable step, with literal instructions and a single Done button.
 * Everything else stays visually quiet — blocked tasks say what they wait
 * on in plain words, done tasks collapse to strikethrough at the bottom.
 */

function isUnblocked(task: LaunchTask, state: LaunchTaskState): boolean {
  return (task.blockedBy ?? []).every((id) => Boolean(state[id]));
}

function blockerTitles(task: LaunchTask, state: LaunchTaskState): string[] {
  return (task.blockedBy ?? [])
    .filter((id) => !state[id])
    .map((id) => LAUNCH_TASKS.find((t) => t.id === id)?.title ?? id);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked — the command is selectable text right there.
        }
      }}
      type="button"
    >
      <CopyIcon className="h-3.5 w-3.5" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function DoneButton({
  task,
  done,
  compact = false,
}: {
  task: LaunchTask;
  done: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className={
        done
          ? 'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted'
          : compact
            ? 'inline-flex items-center gap-1.5 rounded-md border border-green-700/40 px-3 py-1.5 font-medium text-green-700 text-xs transition-colors hover:bg-green-700/10'
            : 'inline-flex items-center gap-2 rounded-lg bg-green-700 px-6 py-3 font-semibold text-sm text-white transition-colors hover:bg-green-800'
      }
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleLaunchTask(task.id, !done);
        })
      }
      type="button"
    >
      {done ? (
        <>
          <UndoIcon className="h-3.5 w-3.5" /> Undo
        </>
      ) : (
        <>
          <CheckIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> Done
        </>
      )}
    </button>
  );
}

function TaskCard({
  task,
  state,
  hero,
}: {
  task: LaunchTask;
  state: LaunchTaskState;
  hero: boolean;
}) {
  const done = Boolean(state[task.id]);
  const blockers = blockerTitles(task, state);

  return (
    <div
      className={
        hero
          ? 'rounded-xl border-2 border-green-700/50 bg-card p-5 shadow-sm'
          : 'rounded-lg border bg-card p-4'
      }
    >
      {hero ? (
        <p className="mb-1 font-semibold text-green-700 text-xs uppercase tracking-wide">
          Do this now
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <h3 className={hero ? 'font-bold text-lg' : 'font-semibold text-sm'}>
          {task.title}
        </h3>
        {!hero && blockers.length === 0 ? (
          <DoneButton compact done={done} task={task} />
        ) : null}
      </div>
      <p className="mt-1 text-muted-foreground text-sm">{task.why}</p>

      {blockers.length > 0 ? (
        <p className="mt-2 text-amber-700 text-xs">
          Waiting on: {blockers.join(' · ')}
        </p>
      ) : null}

      {hero ? (
        <>
          <ol className="mt-4 space-y-2">
            {task.steps.map((step, i) => (
              <li className="flex gap-3 text-sm" key={step}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-xs">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          {task.command ? (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-muted p-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap px-1 text-xs">
                {task.command}
              </code>
              <CopyButton text={task.command} />
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <DoneButton done={done} task={task} />
            {task.href ? (
              <a
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                href={task.href}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                {task.hrefLabel ?? 'Open link'}
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function LaunchChecklist({
  initialState,
}: {
  initialState: LaunchTaskState;
}) {
  const [owner, setOwner] = useState<LaunchOwner>('sam');
  const state = initialState;

  const { hero, upNext, blocked, doneTasks, doneCount, total } = useMemo(() => {
    const mine = LAUNCH_TASKS.filter((t) => t.owner === owner);
    const notDone = mine.filter((t) => !state[t.id]);
    const unblocked = notDone.filter((t) => isUnblocked(t, state));
    return {
      hero: unblocked[0] ?? null,
      upNext: unblocked.slice(1),
      blocked: notDone.filter((t) => !isUnblocked(t, state)),
      doneTasks: mine.filter((t) => Boolean(state[t.id])),
      doneCount: mine.length - notDone.length,
      total: mine.length,
    };
  }, [owner, state]);

  return (
    <div className="max-w-[760px]">
      <div className="flex gap-2">
        {(Object.keys(OWNER_LABELS) as LaunchOwner[]).map((key) => {
          const mine = LAUNCH_TASKS.filter((t) => t.owner === key);
          const mineDone = mine.filter((t) => Boolean(state[t.id])).length;
          return (
            <button
              className={
                owner === key
                  ? 'rounded-full bg-foreground px-4 py-1.5 font-semibold text-background text-sm'
                  : 'rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-muted'
              }
              key={key}
              onClick={() => setOwner(key)}
              type="button"
            >
              {OWNER_LABELS[key]} {mineDone}/{mine.length}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {hero ? (
          <TaskCard hero state={state} task={hero} />
        ) : (
          <div className="rounded-xl border-2 border-green-700/50 bg-card p-5">
            <p className="font-bold text-lg">
              {doneCount === total
                ? `${OWNER_LABELS[owner]} is done. All ${total} tasks ticked. 🎉`
                : 'Nothing doable right now — everything left is waiting on someone else.'}
            </p>
          </div>
        )}

        {upNext.length > 0 ? (
          <>
            <p className="pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Up next (in order — ignore until the top one is done)
            </p>
            {upNext.map((t) => (
              <TaskCard hero={false} key={t.id} state={state} task={t} />
            ))}
          </>
        ) : null}

        {blocked.length > 0 ? (
          <>
            <p className="pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Waiting on others
            </p>
            {blocked.map((t) => (
              <TaskCard hero={false} key={t.id} state={state} task={t} />
            ))}
          </>
        ) : null}

        {doneTasks.length > 0 ? (
          <>
            <p className="pt-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Done
            </p>
            {doneTasks.map((t) => (
              <div
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5"
                key={t.id}
              >
                <span className="text-muted-foreground text-sm line-through">
                  {t.title}
                </span>
                <DoneButton compact done task={t} />
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
