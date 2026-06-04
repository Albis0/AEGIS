import {exec as execCb} from "child_process";

function run(cmd: string, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve) => {
        execCb(cmd, {timeout: timeoutMs, windowsHide: true}, (err, stdout, stderr) => {
            const out = (stdout ?? "").trim();
            if (err && !out) resolve(`HATA: ${err.message}${stderr ? "\n" + stderr.trim() : ""}`);
            else resolve(out || "(tamam)");
        });
    });
}

function ps(script: string): Promise<string> {
    const escaped = script.replace(/"/g, '\\"');
    return run(`powershell -NoProfile -NonInteractive -Command "${escaped}"`);
}

// Spotify process var mı?
async function spotifyRunning(): Promise<boolean> {
    const out = await ps("(Get-Process -Name Spotify -ErrorAction SilentlyContinue) -ne $null");
    return out.trim().toLowerCase() === "true";
}

// Spotify'ı aç (zaten açıksa dokunma)
async function ensureSpotify(): Promise<void> {
    if (!(await spotifyRunning())) {
        await run("start spotify:", 5000);
        // Açılması için bekle
        await new Promise((r) => setTimeout(r, 2000));
    }
}

// Media key gönder (Spotify açık olmalı)
function sendMediaKey(key: "PlayPause" | "NextTrack" | "PrevTrack"): Promise<string> {
    const keyMap: Record<string, string> = {
        PlayPause: "{MEDIA_PLAY_PAUSE}",
        NextTrack: "{MEDIA_NEXT}",
        PrevTrack: "{MEDIA_PREV}",
    };
    const vkMap: Record<string, string> = {
        PlayPause: "0xB3",
        NextTrack: "0xB0",
        PrevTrack: "0xB1",
    };
    // SendKeys yerine WScript.Shell ile daha güvenilir
    const script = `
$wsh = New-Object -ComObject WScript.Shell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${keyMap[key]}')
`;
    // Fallback: VK key press
    const fallback = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KBHook {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
}
"@
[KBHook]::keybd_event(${vkMap[key]}, 0, 1, 0)
Start-Sleep -Milliseconds 50
[KBHook]::keybd_event(${vkMap[key]}, 0, 2, 0)
`;
    return ps(fallback);
}

export async function spotifyPlay(): Promise<string> {
    await ensureSpotify();
    // Zaten çalıyorsa değiştirme, duraklatılmışsa başlat
    const state = await spotifyGetState();
    if (state.includes("Oynuyor")) return "Spotify zaten çalıyor.";
    await sendMediaKey("PlayPause");
    return "Spotify başlatıldı.";
}

export async function spotifyPause(): Promise<string> {
    if (!(await spotifyRunning())) return "Spotify açık değil.";
    const state = await spotifyGetState();
    if (state.includes("Duraklatıldı") || state.includes("açık değil")) return "Spotify zaten duraklatılmış.";
    await sendMediaKey("PlayPause");
    return "Spotify duraklatıldı.";
}

export async function spotifyNext(): Promise<string> {
    await ensureSpotify();
    await sendMediaKey("NextTrack");
    await new Promise((r) => setTimeout(r, 800));
    return "Sonraki parçaya geçildi.";
}

export async function spotifyPrev(): Promise<string> {
    await ensureSpotify();
    await sendMediaKey("PrevTrack");
    await new Promise((r) => setTimeout(r, 800));
    return "Önceki parçaya geri dönüldü.";
}

export async function spotifySetVolume(level: number): Promise<string> {
    // Spotify'ın kendi ses seviyesi değil, sistem ses seviyesi
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    await ps(`$obj = New-Object -ComObject WScript.Shell; (New-Object -ComObject SAPI.SpVoice).Volume = 0
$vol = [Math]::Round(65535 * ${clamped} / 100)
$code = @"
using System.Runtime.InteropServices;
public class Vol {
    [DllImport("winmm.dll")]
    public static extern int waveOutSetVolume(IntPtr h, uint v);
}
"@
Add-Type -TypeDefinition $code
[Vol]::waveOutSetVolume([IntPtr]::Zero, [uint]($vol | % { ($_ -shl 16) -bor $_ }))
`);
    return `Ses seviyesi %${clamped} yapıldı.`;
}

export async function spotifyGetState(): Promise<string> {
    if (!(await spotifyRunning())) return "Spotify açık değil.";
    // Spotify pencere başlığından şarkı bilgisi al
    const title = await ps(
        "(Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -First 1).MainWindowTitle"
    );
    if (!title || title === "(tamam)" || title.toLowerCase().includes("spotify")) {
        // Pencere başlığı boşsa muhtemelen küçültülmüş + duraklatılmış
        return "Spotify açık ama şu an duraklatılmış veya bilgi alınamıyor.";
    }
    return `Şu an oynuyor: ${title}`;
}

export async function spotifyOpen(): Promise<string> {
    await ensureSpotify();
    // Pencereyi öne getir
    await ps(
        "$proc = Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1; if ($proc) { $hw = $proc.MainWindowHandle; Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id) }"
    );
    return "Spotify açıldı.";
}

export async function spotifySearchPlay(query: string): Promise<string> {
    if (!query) return "HATA: Arama sorgusu boş.";
    // Spotify URI ile arama sayfasını aç (masaüstü uygulamasında)
    const encoded = encodeURIComponent(query);
    await run(`start "spotify:search:${encoded}"`, 5000);
    await new Promise((r) => setTimeout(r, 1500));
    return `Spotify'da "${query}" arandı. İlk sonucu çalmak için "spotify çal" de.`;
}
