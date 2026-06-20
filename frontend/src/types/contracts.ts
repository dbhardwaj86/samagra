// src/types/contracts.ts
export type AppId =
  | "dashboard" | "pipelines" | "assignments" | "org" | "questions" | "lectures"
  | "booklets" | "insp" | "sims" | "mycontentdev" | "munshi" | "activity"
  | "settings" | "terminal" | "clock" | "notes" | "snake";

export interface AppMeta { id: AppId; name: string; accent: string; w: number; h: number; }
export interface Rect { x: number; y: number; w: number; h: number; }
export interface WindowState {
  id: string; app: AppId; x: number; y: number; w: number; h: number;
  z: number; min: boolean; max: boolean; prev: Rect | null;
}
export type Theme = "aqua" | "console" | "samagra";
export type Device = "pc" | "mobile";

export const MIN_W = 360;
export const MIN_H = 280;

// Terminal
export type LineClass = "in" | "fg" | "dim" | "accent" | "ok" | "err";
export interface TermLine { t: string; c: LineClass; }
export type TermEffect =
  | { kind: "openApp"; value: AppId }
  | { kind: "setTheme"; value: Theme }
  | { kind: "setDevice"; value: Device };
export interface TermCtx { order: AppId[]; apps: Record<AppId, AppMeta>; }

// Notes / todos
export interface Note { id: string; title: string; body: string; ts: number; }
export interface Todo { id: string; text: string; done: boolean; }
export type TodoFilter = "all" | "active" | "done";

// Backend
export interface ApiClient {
  overview(): Promise<unknown>;
  pipelines(): Promise<unknown>;
  assignments(): Promise<unknown>;
}
