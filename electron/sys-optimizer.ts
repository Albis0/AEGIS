import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PERF_STATE_PATH = path.join(os.homedir(), ".aegis", "perf-mode-state.json");

function runPs(script: string, timeoutMs = 30000): Promise<string> {
    // Send the script over stdin — injection-proof
    return new Promise((res) => {
        const child = execCb(
            "powershell -NoProfile -NonInteractive -Command -",
            {timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024},
            (err, stdout, stderr) => {
                const out = (stdout ?? "").trim();
                const errOut = (stderr ?? "").trim();
                if (err && !out) res(`ERROR: ${err.message}\n${errOut}`.slice(0, 1000));
                else res((out || errOut || "(no output)").slice(0, 2000));
            }
        );
        child.stdin?.end(script);
    });
}
function save(p: string, data: unknown): void {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export async function killHeavyProcesses(topN: number, confirm: boolean): Promise<string> {
    const n = Math.min(topN || 3, 10);
    const list = await runPs(`Get-Process | Sort-Object CPU -Descending | Select-Object -First ${n} | Select-Object Name,Id,@{N='CPU';E={[math]::Round($_.CPU,1)}},@{N='RAMMB';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json -Compress`);
    if (!list || list.startsWith("ERROR")) return list || "Could not get the process list.";
    try {
        const procs = JSON.parse(list.startsWith("[") ? list : `[${list}]`);
        const summary = procs.map((p: {Name: string; Id: number; CPU: number; RAMMB: number}) =>
            `${p.Name} (PID:${p.Id}) — CPU:${p.CPU}s RAM:${p.RAMMB}MB`
        ).join("\n");
        if (!confirm) return `The ${n} most resource-hungry processes:\n${summary}\n\nCall again with confirm:true to close them.`;
        // Kill them (excluding system-critical ones)
        const safe = procs.filter((p: {Name: string}) => !["System", "svchost", "csrss", "lsass", "winlogon", "explorer"].includes(p.Name));
        if (safe.length === 0) return "No processes found that can be safely closed.";
        for (const proc of safe) {
            await runPs(`Stop-Process -Id ${proc.Id} -Force -ErrorAction SilentlyContinue`);
        }
        return `${safe.length} processes closed:\n${safe.map((p: {Name: string}) => p.Name).join(", ")}`;
    } catch { return list.slice(0, 500); }
}

export async function suspendProcess(name: string): Promise<string> {
    const safeName = name.replace(/['"`;$&|<>(){}]/g, "");
    const result = await runPs(`$n = '${safeName}'; $proc = Get-Process -Name $n -ErrorAction SilentlyContinue; if ($proc) { $proc | ForEach-Object { $_.PriorityClass = 'Idle' }; "OK: $n priority lowered (Idle)" } else { "ERROR: $n not found" }`);
    return result;
}

export async function resumeProcess(name: string): Promise<string> {
    const safeName = name.replace(/['"`;$&|<>(){}]/g, "");
    const result = await runPs(`$n = '${safeName}'; $proc = Get-Process -Name $n -ErrorAction SilentlyContinue; if ($proc) { $proc | ForEach-Object { $_.PriorityClass = 'Normal' }; "OK: $n priority restored to normal" } else { "ERROR: $n not found" }`);
    return result;
}

export async function clearTemp(): Promise<string> {
    const tempPath = os.tmpdir().replace(/\\/g, "\\\\");
    const userTemp = path.join(os.homedir(), "AppData\\Local\\Temp").replace(/\\/g, "\\\\");
    const result = await runPs(`
$before = (Get-ChildItem "${tempPath}" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum ?? 0
Remove-Item "${tempPath}\\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "${userTemp}\\*" -Recurse -Force -ErrorAction SilentlyContinue
$after = (Get-ChildItem "${tempPath}" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum ?? 0
$freed = [math]::Round(($before - $after) / 1MB, 1)
"Cleaned: $freed MB freed"
    `.replace(/\n/g, " "), 30000);
    return result || "Temp cleanup complete.";
}

export async function flushDns(): Promise<string> {
    return runPs("Clear-DnsClientCache; 'DNS cache cleared.'");
}

export async function startupManager(action: "list" | "disable", name?: string): Promise<string> {
    if (action === "list") {
        return runPs("Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | ConvertTo-Json -Compress");
    }
    if (action === "disable" && name) {
        const safeName = name.replace(/['"`;$&|<>(){}]/g, "");
        return runPs(`$n = '${safeName}'; $item = Get-CimInstance Win32_StartupCommand | Where-Object {$_.Name -like "*$n*"} | Select-Object -First 1; if ($item) { Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name $item.Name -ErrorAction SilentlyContinue; "Disabled: $($item.Name)" } else { "Not found: $n" }`);
    }
    return "ERROR: Invalid action.";
}

export async function perfModeStart(): Promise<string> {
    save(PERF_STATE_PATH, {active: true, startedAt: new Date().toISOString()});
    const result = await runPs(`
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
Get-Process | Where-Object {$_.Name -in @('OneDrive','Teams','Discord','Slack','Dropbox')} | ForEach-Object { $_.PriorityClass = 'Idle' }
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 0 -ErrorAction SilentlyContinue
"Performance mode active: power plan 'High Performance', background apps set to Idle."
    `.replace(/\n/g, "; "), 15000);
    return result || "Performance mode started.";
}

export async function perfModeStop(): Promise<string> {
    save(PERF_STATE_PATH, {active: false});
    const result = await runPs(`
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null
Get-Process | Where-Object {$_.Name -in @('OneDrive','Teams','Discord','Slack','Dropbox')} | ForEach-Object { try { $_.PriorityClass = 'Normal' } catch {} }
"Normal mode restored."
    `.replace(/\n/g, "; "), 15000);
    return result || "Performance mode stopped.";
}
