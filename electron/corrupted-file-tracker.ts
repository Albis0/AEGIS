// Shared registry so any ~/.aegis/*.json reader can report "this file was
// corrupt and reset to defaults" without each module inventing its own signal.
// main.ts reads this once at startup and shows a single user-visible notice.

const corrupted: string[] = [];

export function reportCorruptedFile(label: string): void {
    corrupted.push(label);
}

export function getCorruptedFiles(): string[] {
    return corrupted;
}
