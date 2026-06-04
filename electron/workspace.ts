import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const WORKSPACES_DIR = path.join(os.homedir(), ".aegis", "workspaces");
const ACTIVE_WS_PATH = path.join(os.homedir(), ".aegis", "active-workspace.json");

interface WorkspaceConfig {
    name: string;
    description: string;
    systemPrompt?: string;
    model?: string;
    persona?: string;
    workingDir?: string;
    createdAt: string;
    updatedAt: string;
}

interface ActiveWorkspace {
    name: string;
    switchedAt: string;
}

function ensureDir(): void {
    fs.mkdirSync(WORKSPACES_DIR, {recursive: true});
}
function load<T>(p: string, def: T): T {
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return def; }
}
function save(p: string, data: unknown): void {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function wsDir(name: string): string {
    return path.join(WORKSPACES_DIR, name.replace(/[^a-z0-9_-]/gi, "_"));
}

export function workspaceCreate(name: string, description: string, systemPrompt?: string, model?: string, workingDir?: string): string {
    if (!name) return "HATA: Workspace adı gerekli.";
    ensureDir();
    const dir = wsDir(name);
    if (fs.existsSync(dir)) return `HATA: "${name}" adlı workspace zaten var.`;
    fs.mkdirSync(dir, {recursive: true});
    const config: WorkspaceConfig = {
        name,
        description: description || "",
        systemPrompt,
        model,
        workingDir,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    save(path.join(dir, "config.json"), config);
    save(path.join(dir, "messages.json"), []);
    return `Workspace oluşturuldu: "${name}". Geçiş için 'workspace_switch ${name}' kullan.`;
}

export function workspaceSwitch(name: string): {result: string; config: WorkspaceConfig | null} {
    if (!name) return {result: "HATA: Workspace adı gerekli.", config: null};
    ensureDir();
    const dir = wsDir(name);
    if (!fs.existsSync(dir)) return {result: `HATA: "${name}" adlı workspace bulunamadı.`, config: null};
    const config: WorkspaceConfig = load(path.join(dir, "config.json"), {name, description: "", createdAt: "", updatedAt: ""});
    save(ACTIVE_WS_PATH, {name, switchedAt: new Date().toISOString()});
    config.updatedAt = new Date().toISOString();
    save(path.join(dir, "config.json"), config);
    return {
        result: `Workspace değiştirildi: "${name}"${config.description ? ` — ${config.description}` : ""}${config.model ? ` | Model: ${config.model}` : ""}`,
        config,
    };
}

export function workspaceList(): string {
    ensureDir();
    const active = load<ActiveWorkspace | null>(ACTIVE_WS_PATH, null);
    const dirs = fs.readdirSync(WORKSPACES_DIR).filter((d) => {
        try { return fs.statSync(path.join(WORKSPACES_DIR, d)).isDirectory(); } catch { return false; }
    });
    if (dirs.length === 0) return "Workspace yok. 'workspace_create' ile oluştur.";
    return dirs.map((d) => {
        const cfg: WorkspaceConfig = load(path.join(WORKSPACES_DIR, d, "config.json"), {name: d, description: ""} as WorkspaceConfig);
        const isActive = active?.name === cfg.name;
        return `${isActive ? "► " : "  "}${cfg.name}${cfg.description ? ` — ${cfg.description}` : ""}${cfg.model ? ` [${cfg.model}]` : ""}`;
    }).join("\n");
}

export function workspaceDelete(name: string): string {
    ensureDir();
    const dir = wsDir(name);
    if (!fs.existsSync(dir)) return `HATA: "${name}" bulunamadı.`;
    fs.rmSync(dir, {recursive: true, force: true});
    const active = load<ActiveWorkspace | null>(ACTIVE_WS_PATH, null);
    if (active?.name === name) { try { fs.unlinkSync(ACTIVE_WS_PATH); } catch {} }
    return `Workspace silindi: "${name}"`;
}

export function getActiveWorkspace(): WorkspaceConfig | null {
    const active = load<ActiveWorkspace | null>(ACTIVE_WS_PATH, null);
    if (!active) return null;
    const dir = wsDir(active.name);
    if (!fs.existsSync(dir)) return null;
    return load<WorkspaceConfig | null>(path.join(dir, "config.json"), null);
}

export function workspaceExport(name: string): string {
    ensureDir();
    const dir = wsDir(name);
    if (!fs.existsSync(dir)) return `HATA: "${name}" bulunamadı.`;
    const config: WorkspaceConfig = load(path.join(dir, "config.json"), {name} as WorkspaceConfig);
    const messages = load(path.join(dir, "messages.json"), []);
    const exportData = {config, messages};
    const exportPath = path.join(os.homedir(), ".aegis", `workspace_${name}_export.json`);
    save(exportPath, exportData);
    return `Workspace dışa aktarıldı: ${exportPath}`;
}

export function workspaceImport(filePath: string): string {
    if (!fs.existsSync(filePath)) return `HATA: Dosya bulunamadı: ${filePath}`;
    ensureDir();
    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const config: WorkspaceConfig = data.config;
        if (!config?.name) return "HATA: Geçersiz workspace export dosyası.";
        const dir = wsDir(config.name);
        if (fs.existsSync(dir)) return `HATA: "${config.name}" zaten var.`;
        fs.mkdirSync(dir, {recursive: true});
        save(path.join(dir, "config.json"), config);
        save(path.join(dir, "messages.json"), data.messages ?? []);
        return `Workspace içe aktarıldı: "${config.name}"`;
    } catch (e) {
        return `HATA: ${(e as Error).message}`;
    }
}
