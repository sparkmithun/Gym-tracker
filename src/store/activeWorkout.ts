import { create } from 'zustand';
import { kvGet, kvSet } from '@/db/client';
import type { DraftExercise, DraftWorkout } from '@/features/workout/draft';
import { cancelRestDone, scheduleRestDone } from '@/features/workout/restTimer';
import { nowIso, uuid } from '@/utils/uuid';

type Rest = { endsAt: number; total: number; notificationId: string | null };

type State = {
  workout: DraftWorkout | null;
  rest: Rest | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  start: (opts?: { title?: string; routineId?: string | null; exercises?: DraftExercise[] }) => void;
  setExercises: (fn: (list: DraftExercise[]) => DraftExercise[]) => void;
  patch: (p: Partial<Pick<DraftWorkout, 'title' | 'notes' | 'visibility' | 'photoUrl' | 'startedAt'>>) => void;
  discard: () => void;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
};

const KEY = 'active_workout';

function defaultTitle() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

export const useActiveWorkout = create<State>((set, get) => ({
  workout: null,
  rest: null,
  hydrated: false,

  hydrate: async () => {
    const raw = await kvGet(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { workout: DraftWorkout; rest: Rest | null };
        const rest = parsed.rest && parsed.rest.endsAt > Date.now() ? parsed.rest : null;
        set({ workout: parsed.workout, rest });
      } catch {
        await kvSet(KEY, null);
      }
    }
    set({ hydrated: true });
  },

  start: (opts = {}) =>
    set({
      workout: {
        id: uuid(),
        routineId: opts.routineId ?? null,
        title: opts.title ?? defaultTitle(),
        notes: '',
        startedAt: nowIso(),
        endedAt: null,
        visibility: 'public',
        photoUrl: null,
        exercises: opts.exercises ?? [],
      },
      rest: null,
    }),

  setExercises: (fn) => {
    const w = get().workout;
    if (w) set({ workout: { ...w, exercises: fn(w.exercises) } });
  },

  patch: (p) => {
    const w = get().workout;
    if (w) set({ workout: { ...w, ...p } });
  },

  discard: () => {
    cancelRestDone(get().rest?.notificationId);
    set({ workout: null, rest: null });
  },

  startRest: (seconds) => {
    cancelRestDone(get().rest?.notificationId);
    if (seconds <= 0) return set({ rest: null });
    const rest: Rest = { endsAt: Date.now() + seconds * 1000, total: seconds, notificationId: null };
    set({ rest });
    scheduleRestDone(seconds).then((id) => {
      const cur = get().rest;
      if (cur && cur.endsAt === rest.endsAt) set({ rest: { ...cur, notificationId: id } });
      else cancelRestDone(id);
    });
  },

  adjustRest: (delta) => {
    const cur = get().rest;
    if (!cur) return;
    const remaining = (cur.endsAt - Date.now()) / 1000 + delta;
    if (remaining <= 0) return get().skipRest();
    get().startRest(Math.round(remaining));
    const next = get().rest;
    if (next) set({ rest: { ...next, total: Math.max(cur.total + delta, Math.round(remaining)) } });
  },

  skipRest: () => {
    cancelRestDone(get().rest?.notificationId);
    set({ rest: null });
  },
}));

// Persist every change (debounced) so a crash or OS kill never loses a workout.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
useActiveWorkout.subscribe((s, prev) => {
  if (!s.hydrated || (s.workout === prev.workout && s.rest === prev.rest)) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { workout, rest } = useActiveWorkout.getState();
    kvSet(KEY, workout ? JSON.stringify({ workout, rest }) : null).catch((e) => console.warn('[persist]', e));
  }, 300);
});
