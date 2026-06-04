import {exec as execCb} from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PERF_STATE_PATH = path.join(os.homedir(), ".aegis", "perf-mode-state.json");

function runPs(cmd: string, timeoutMs = 30000): Promise<string> {
    return new Promise((res) => {
        execCb(`powershell -NoProfile -Command "${cmd.replace(/\\/g, "\\\\")}"`,
            {timeout: timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024},
            (err, stdout, stderr) => {
                const out = (stdout ?? "").trim();
                const errOut = (stderr ?? "").trim();
                if (err && !out) res(`HATA: ${err.message}\n${errOut}`.slice(0, 1000));
                else res((out || errOut || "(çıktı yok)").slice(0, 2000));
            }
        );
    });
}
function save(p: string, data: unknown): void {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export async function killHeavyProcesses(topN: number, confirm: boolean): Promise<string> {
    const n = Math.min(topN || 3, 10);
    const list = await runPs(`Get-Process | Sort-Object CPU -Descending | Select-Object -First ${n} | Select-Object Name,Id,@{N='CPU';E={[math]::Round($_.CPU,1)}},@{N='RAMMB';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json -Compress`);
    if (!list || list.startsWith("HATA")) return list || "Proses listesi alınamadı.";
    try {
        const procs = JSON.parse(list.startsWith("[") ? list : `[${list}]`);
        const summary = procs.map((p: {Name: string; Id: number; CPU: number; RAMMB: number}) =>
            `${p.Name} (PID:${p.Id}) — CPU:${p.CPU}s RAM:${p.RAMMB}MB`
        ).join("\n");
        if (!confirm) return `En fazla kaynak tüketen ${n} proses:\n${summary}\n\nKapatmak için confirm:true ile tekrar çağır.`;
        // Kill them (excluding system-critical ones)
        const safe = procs.filter((p: {Name: string}) => !["System", "svchost", "csrss", "lsass", "winlogon", "explorer"].includes(p.Name));
        if (safe.length === 0) return "Güvenli kapatılabilecek proses bulunamadı.";
        for (const proc of safe) {
            await runPs(`Stop-Process -Id ${proc.Id} -Force -ErrorAction SilentlyContinue`);
        }
        return `${safe.length} proses kapatıldı:\n${safe.map((p: {Name: string}) => p.Name).join(", ")}`;
    } catch { return list.slice(0, 500); }
}

export async function suspendProcess(name: string): Promise<string> {
    const result = await runPs(`$proc = Get-Process -Name "${name}" -ErrorAction SilentlyContinue; if ($proc) { $proc | ForEach-Object { $_.PriorityClass = 'Idle' }; "OK: ${name} önceliği düşürüldü (Idle)" } else { "HATA: ${name} bulunamadı" }`);
    return result;
}

export async function resumeProcess(name: string): Promise<string> {
    const result = await runPs(`$proc = Get-Process -Name "${name}" -ErrorAction SilentlyContinue; if ($proc) { $proc | ForEach-Object { $_.PriorityClass = 'Normal' }; "OK: ${name} önceliği normal'e döndürüldü" } else { "HATA: ${name} bulunamadı" }`);
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
"Temizlendi: $freed MB yer açıldı"
    `.replace(/\n/g, " "), 30000);
    return result || "Temp temizleme tamamlandı.";
}

export async function flushDns(): Promise<string> {
    return runPs("Clear-DnsClientCache; 'DNS önbelleği temizlendi.'");
}

export async function startupManager(action: "list" | "disable", name?: string): Promise<string> {
    if (action === "list") {
        return runPs("Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | ConvertTo-Json -Compress");
    }
    if (action === "disable" && name) {
        return runPs(`$item = Get-CimInstance Win32_StartupCommand | Where-Object {$_.Name -like "*${name}*"} | Select-Object -First 1; if ($item) { Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "$($item.Name)" -ErrorAction SilentlyContinue; "Devre dışı bırakıldı: $($item.Name)" } else { "Bulunamadı: ${name}" }`);
    }
    return "HATA: Geçersiz eylem.";
}

export async function perfModeStart(): Promise<string> {
    save(PERF_STATE_PATH, {active: true, startedAt: new Date().toISOString()});
    const result = await runPs(`
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
Get-Process | Where-Object {$_.Name -in @('OneDrive','Teams','Discord','Slack','Dropbox')} | ForEach-Object { $_.PriorityClass = 'Idle' }
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" -Name "AppCaptureEnabled" -Value 0 -ErrorAction SilentlyContinue
"Performans modu aktif: güç planı 'Yüksek Performans', arka plan uygulamaları Idle."
    `.replace(/\n/g, "; "), 15000);
    return result || "Performans modu başlatıldı.";
}

export async function perfModeStop(): Promise<string> {
    save(PERF_STATE_PATH, {active: false});
    const result = await runPs(`
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null
Get-Process | Where-Object {$_.Name -in @('OneDrive','Teams','Discord','Slack','Dropbox')} | ForEach-Object { try { $_.PriorityClass = 'Normal' } catch {} }
"Normal mod geri yüklendi."
    `.replace(/\n/g, "; "), 15000);
    return result || "Performans modu durduruldu.";
}
