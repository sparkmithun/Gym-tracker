import { create } from 'zustand';
import type { ExerciseType } from '@/db/types';

export type Picked = { id: string; name: string; type: ExerciseType };

// The exercise library is a separate screen; callers register what to do with the selection
// before navigating to it.
type PickerState = {
  onPick: ((picked: Picked[]) => void) | null;
  multi: boolean;
  open: (onPick: (picked: Picked[]) => void, multi?: boolean) => void;
  clear: () => void;
};

export const usePicker = create<PickerState>((set) => ({
  onPick: null,
  multi: true,
  open: (onPick, multi = true) => set({ onPick, multi }),
  clear: () => set({ onPick: null }),
}));
