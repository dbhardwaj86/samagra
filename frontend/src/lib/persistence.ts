const _ls: Storage | undefined =
  typeof localStorage !== "undefined" ? localStorage : undefined;

export const KEYS = {
  notes: "samagra.notes",
  todos: "samagra.todos",
  snakeBest: "samagra.snake.best",
  snakeLevel: "samagra.snake.level",
} as const;

export function load<T>(key: string, fallback: T, storage: Storage | undefined = _ls): T {
  if (!storage) return fallback;
  const raw = storage.getItem(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Defensive: if the fallback is an array, the parsed value must be too.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T, storage: Storage | undefined = _ls): void {
  if (!storage) return;
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* quota — no-op */ }
}
