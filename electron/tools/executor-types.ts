// Shared executor signature (audit C2) — kept in its own module so domain
// executor files don't need to import tools.ts (which imports them).
export type ToolExecutor = (args: Record<string, string>) => Promise<string>;
