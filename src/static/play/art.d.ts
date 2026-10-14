// Types for art.js, so the server pages can render portraits.
export const CREW: { id: string; name: string; zh: string; color: string; line: string }[];
export const ICONS: Record<string, string>;
export const FAC: { id: string; name: string; svg: string }[];
export function portrait(id: string, label?: string): string;
