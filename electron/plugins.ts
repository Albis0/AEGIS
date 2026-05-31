import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";

export interface PluginManifest {
    name: string;
    version?: string;
    tools: {
        name: string;
        description: string;
        parameters: {type: string; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: boolean};
    }[];
}

export interface LoadedPlugin {
    name: string;
    dir: string;
    tools: string[];
}

let _loadedPlugins: LoadedPlugin[] = [];

export function loadPlugins(): {
    schemas: ChatCompletionTool[];
    executors: Record<string, (args: Record<string, unknown>) => Promise<string>>;
    plugins: LoadedPlugin[];
} {
    const pluginsDir = path.join(os.homedir(), ".aegis", "plugins");
    const schemas: ChatCompletionTool[] = [];
    const executors: Record<string, (args: Record<string, unknown>) => Promise<string>> = {};
    const plugins: LoadedPlugin[] = [];

    if (!fs.existsSync(pluginsDir)) {
        _loadedPlugins = [];
        return {schemas, executors, plugins};
    }

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(pluginsDir, {withFileTypes: true});
    } catch {
        _loadedPlugins = [];
        return {schemas, executors, plugins};
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(pluginsDir, entry.name);
        const manifestPath = path.join(dir, "manifest.json");
        const indexPath = path.join(dir, "index.js");

        if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) continue;

        try {
            const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

            // Clear require cache so reload works correctly
            const resolvedIndex = require.resolve(indexPath);
            if (require.cache[resolvedIndex]) delete require.cache[resolvedIndex];
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pluginModule = require(indexPath) as Record<string, unknown>;

            const toolNames: string[] = [];
            for (const tool of manifest.tools) {
                if (typeof pluginModule[tool.name] !== "function") continue;
                executors[tool.name] = pluginModule[tool.name] as (args: Record<string, unknown>) => Promise<string>;
                toolNames.push(tool.name);
                schemas.push({
                    type: "function",
                    function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.parameters as object,
                    },
                } as ChatCompletionTool);
            }

            if (toolNames.length > 0) {
                plugins.push({name: manifest.name, dir, tools: toolNames});
            }
        } catch (e) {
            console.error(`[plugins] Yükleme hatası (${entry.name}):`, e);
        }
    }

    _loadedPlugins = plugins;
    return {schemas, executors, plugins};
}

export function getLoadedPlugins(): LoadedPlugin[] {
    return _loadedPlugins;
}
