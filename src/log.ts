// One JSON line per entry on stdout (DESIGN.md, Logs). Never pass a token.
export function log(entry: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ t: Date.now(), ...entry })}\n`);
}

export const roundMs = (ms: number): number => Math.round(ms * 10) / 10;
