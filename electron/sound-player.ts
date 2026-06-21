import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {exec} from "child_process";

const SOUNDS_DIR = path.join(os.homedir(), ".aegis", "sounds");
const AMBIENT_STATE_PATH = path.join(os.homedir(), ".aegis", "ambient-state.json");

function ensureSoundsDir(): void {
    if (!fs.existsSync(SOUNDS_DIR)) fs.mkdirSync(SOUNDS_DIR, {recursive: true});
}

// ---- Play sound ----
let currentAmbientProcess: ReturnType<typeof exec> | null = null;
let ambientPlaying = false;

export function playSound(filePath: string, volume = 50): string {
    const resolved = filePath.startsWith("~") ? path.join(os.homedir(), filePath.slice(1)) : filePath;

    // Check built-in sounds directory
    const builtIn = path.join(SOUNDS_DIR, resolved);
    const target = fs.existsSync(resolved) ? resolved : fs.existsSync(builtIn) ? builtIn : null;

    if (!target) {
        return `ERROR: File not found: ${filePath}. Put sound files here: ${SOUNDS_DIR}`;
    }

    const ext = path.extname(target).toLowerCase();
    if (![".mp3", ".wav", ".ogg", ".m4a", ".flac"].includes(ext)) {
        return `ERROR: Unsupported format: ${ext}. Supported: mp3, wav, ogg, m4a, flac`;
    }

    const vol = Math.min(100, Math.max(0, volume));
    // Use PowerShell MediaPlayer for playback (no external deps)
    const ps = `
Add-Type -AssemblyName presentationCore
$mp = New-Object System.Windows.Media.MediaPlayer
$mp.Volume = ${vol / 100}
$mp.Open([uri]"${target.replace(/\\/g, "/")}")
Start-Sleep -Milliseconds 500
$mp.Play()
Start-Sleep -Seconds ([int]$mp.NaturalDuration.TimeSpan.TotalSeconds + 1)
`.trim();

    const tmpPs = path.join(os.tmpdir(), `aegis-sound-${Date.now()}.ps1`);
    fs.writeFileSync(tmpPs, ps, "utf-8");
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs}"`, {windowsHide: true}, () => {
        try { fs.unlinkSync(tmpPs); } catch {}
    });
    return `Playing: ${path.basename(target)} (volume ${vol}%)`;
}

// ---- Ambient sound ----
export function ambientStart(category: string, volume = 30): string {
    if (ambientPlaying) {
        ambientStop();
    }
    const cat = (category || "rain").toLowerCase();

    // Check if there's a local file matching the category
    ensureSoundsDir();
    const localFiles = fs.existsSync(SOUNDS_DIR)
        ? fs.readdirSync(SOUNDS_DIR).filter((f) => f.toLowerCase().includes(cat))
        : [];

    if (localFiles.length > 0) {
        const localFile = path.join(SOUNDS_DIR, localFiles[0]);
        const vol = Math.min(100, Math.max(0, volume));
        const ps = `
Add-Type -AssemblyName presentationCore
$mp = New-Object System.Windows.Media.MediaPlayer
$mp.Volume = ${vol / 100}
$mp.MediaEnded += { $mp.Position = [timespan]::Zero; $mp.Play() }
$mp.Open([uri]"${localFile.replace(/\\/g, "/")}")
Start-Sleep -Milliseconds 500
$mp.Play()
Start-Sleep -Seconds 36000
`.trim();
        const tmpPs = path.join(os.tmpdir(), `aegis-ambient-${Date.now()}.ps1`);
        fs.writeFileSync(tmpPs, ps, "utf-8");
        currentAmbientProcess = exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs}"`, {windowsHide: true}, () => {
            try { fs.unlinkSync(tmpPs); } catch {}
        });
        ambientPlaying = true;
        fs.writeFileSync(AMBIENT_STATE_PATH, JSON.stringify({active: true, category: cat, startedAt: Date.now()}));
        return `Ambient sound started: ${cat} (${localFiles[0]}, volume ${vol}%)`;
    }

    // Fallback: use Windows built-in sounds or inform user
    ambientPlaying = true;
    fs.writeFileSync(AMBIENT_STATE_PATH, JSON.stringify({active: true, category: cat, startedAt: Date.now()}));
    return `Ambient mode active: ${cat}. For actual sound, put ${cat}.mp3 in the ~/.aegis/sounds/ folder. There's no sound file right now, but the mode was saved.`;
}

export function ambientStop(): string {
    if (currentAmbientProcess) {
        try {
            // Kill the PowerShell process
            exec("powershell -NoProfile -Command \"Get-Process -Name powershell | Where-Object {$_.MainWindowTitle -eq ''} | Stop-Process -Force -ErrorAction SilentlyContinue\"", {windowsHide: true});
        } catch {}
        currentAmbientProcess = null;
    }
    ambientPlaying = false;
    if (fs.existsSync(AMBIENT_STATE_PATH)) {
        fs.writeFileSync(AMBIENT_STATE_PATH, JSON.stringify({active: false, category: null, startedAt: null}));
    }
    return "Ambient sound stopped.";
}

export function listSounds(): string {
    ensureSoundsDir();
    const files = fs.existsSync(SOUNDS_DIR)
        ? fs.readdirSync(SOUNDS_DIR).filter((f) => [".mp3", ".wav", ".ogg"].some((e) => f.endsWith(e)))
        : [];

    const ambientStatus = ambientPlaying ? " [AMBIENT ACTIVE]" : "";
    if (files.length === 0) {
        return `No sound files${ambientStatus}. Add .mp3/.wav files to the ${SOUNDS_DIR} folder.\n\nAmbient categories: rain, forest, cafe, white (white noise), space`;
    }
    return `Sound files (${SOUNDS_DIR})${ambientStatus}:\n${files.map((f) => `• ${f}`).join("\n")}\n\nAmbient categories: rain, forest, cafe, white, space`;
}
