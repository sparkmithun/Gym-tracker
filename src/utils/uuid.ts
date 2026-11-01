import { randomUUID } from 'expo-crypto';

export const uuid = (): string => randomUUID();
export const nowIso = (): string => new Date().toISOString();
