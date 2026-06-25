import {exec as execCb} from "child_process";

function ps(script: string, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve) => {
        const child = execCb(
            "powershell -NoProfile -NonInteractive -Command -",
            {timeout: timeoutMs, windowsHide: true},
            (err, stdout, stderr) => {
                const out = (stdout ?? "").trim();
                if (err && !out) {
                    const detail = `${err.message}${stderr ? "\n" + stderr.trim() : ""}`;
                    if (/access is denied|access denied|unauthorized/i.test(detail)) {
                        resolve(`ERROR: Permission denied. Windows blocked this action — try running AEGIS as Administrator if you need this.`);
                    } else {
                        resolve(`ERROR: ${detail}`);
                    }
                }
                else resolve(out || "(ok)");
            }
        );
        child.stdin?.end(script);
    });
}

// ── WinAPI P/Invoke code (one-time Add-Type per call) ────────────────────────
const WIN_API_CODE = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinInput {
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint Type;
        public MOUSEKEYBDHARDWAREINPUT Data;
    }
    [StructLayout(LayoutKind.Explicit)]
    public struct MOUSEKEYBDHARDWAREINPUT {
        [FieldOffset(0)] public MOUSEINPUT Mouse;
        [FieldOffset(0)] public KEYBDINPUT Keyboard;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int X; public int Y;
        public uint MouseData; public uint Flags; public uint Time;
        public IntPtr ExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort Vk; public ushort Scan;
        public uint Flags; public uint Time;
        public IntPtr ExtraInfo;
    }

    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);

    public const uint INPUT_MOUSE = 0;
    public const uint INPUT_KEYBOARD = 1;
    public const uint MOUSEEVENTF_LEFTDOWN   = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP     = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN  = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP    = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP   = 0x0040;
    public const uint MOUSEEVENTF_WHEEL      = 0x0800;
    public const uint KEYEVENTF_KEYUP        = 0x0002;
    public const uint KEYEVENTF_EXTENDEDKEY  = 0x0001;

    public static void MouseClick(uint downFlag, uint upFlag) {
        var inputs = new INPUT[2];
        inputs[0].Type = INPUT_MOUSE; inputs[0].Data.Mouse.Flags = downFlag;
        inputs[1].Type = INPUT_MOUSE; inputs[1].Data.Mouse.Flags = upFlag;
        SendInput(2, inputs, System.Runtime.InteropServices.Marshal.SizeOf(typeof(INPUT)));
    }
    public static void KeyEvent(ushort vk, bool up) {
        var inp = new INPUT[1];
        inp[0].Type = INPUT_KEYBOARD;
        inp[0].Data.Keyboard.Vk = vk;
        inp[0].Data.Keyboard.Flags = up ? KEYEVENTF_KEYUP : 0u;
        SendInput(1, inp, System.Runtime.InteropServices.Marshal.SizeOf(typeof(INPUT)));
    }
}
"@ -ErrorAction SilentlyContinue
`;

// ── Coordinate bounds check ───────────────────────────────────────────────────
// The model picks (x, y) from a screenshot it interpreted — it can be wrong about
// what's there. We can't know if a coordinate is "a delete button" vs "a save
// button", but we CAN refuse coordinates that aren't even on a screen, which
// catches the most common failure mode (hallucinated/stale coordinates from a
// previous, differently-sized screenshot).
let _screenBoundsCache: {width: number; height: number} | null = null;
async function isWithinScreenBounds(x: number, y: number): Promise<boolean> {
    if (!_screenBoundsCache) _screenBoundsCache = await getScreenSize();
    return x >= 0 && y >= 0 && x <= _screenBoundsCache.width && y <= _screenBoundsCache.height;
}

// ── Mouse move ───────────────────────────────────────────────────────────────
export async function mouseMove(x: number, y: number): Promise<string> {
    if (!(await isWithinScreenBounds(x, y))) return `ERROR: Coordinate (${Math.round(x)}, ${Math.round(y)}) is outside the screen bounds.`;
    await ps(`${WIN_API_CODE}
[WinInput]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})`);
    return `Mouse moved to (${Math.round(x)}, ${Math.round(y)}).`;
}

// ── Mouse click ──────────────────────────────────────────────────────────────
export async function mouseClick(
    x: number,
    y: number,
    button: "left" | "right" | "middle" = "left",
    double = false
): Promise<string> {
    const flags: Record<string, [string, string]> = {
        left:   ["MOUSEEVENTF_LEFTDOWN",   "MOUSEEVENTF_LEFTUP"],
        right:  ["MOUSEEVENTF_RIGHTDOWN",  "MOUSEEVENTF_RIGHTUP"],
        middle: ["MOUSEEVENTF_MIDDLEDOWN", "MOUSEEVENTF_MIDDLEUP"],
    };
    if (!(await isWithinScreenBounds(x, y))) return `ERROR: Coordinate (${Math.round(x)}, ${Math.round(y)}) is outside the screen bounds.`;
    const [dn, up] = flags[button] ?? flags.left;
    const clicks = double ? 2 : 1;
    await ps(`${WIN_API_CODE}
[WinInput]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
Start-Sleep -Milliseconds 60
for ($i = 0; $i -lt ${clicks}; $i++) {
    [WinInput]::MouseClick([WinInput]::${dn}, [WinInput]::${up})
    Start-Sleep -Milliseconds 50
}`);
    return `${double ? "Double " : ""}${button === "right" ? "Right" : button === "middle" ? "Middle" : "Left"} click: (${Math.round(x)}, ${Math.round(y)})`;
}

// ── Mouse scroll ──────────────────────────────────────────────────────────────
export async function mouseScroll(
    x: number,
    y: number,
    direction: "up" | "down" = "down",
    amount = 3
): Promise<string> {
    if (!(await isWithinScreenBounds(x, y))) return `ERROR: Coordinate (${Math.round(x)}, ${Math.round(y)}) is outside the screen bounds.`;
    const delta = direction === "up" ? 120 * amount : -120 * amount;
    await ps(`${WIN_API_CODE}
[WinInput]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
Start-Sleep -Milliseconds 60
$inp = New-Object WinInput+INPUT
$inp.Type = [WinInput]::INPUT_MOUSE
$inp.Data.Mouse.Flags = [WinInput]::MOUSEEVENTF_WHEEL
$inp.Data.Mouse.MouseData = [uint32]${delta}
[WinInput]::SendInput(1, @($inp), [System.Runtime.InteropServices.Marshal]::SizeOf([WinInput+INPUT]))`);
    return `Scroll ${direction} (${amount} steps) @ (${Math.round(x)}, ${Math.round(y)})`;
}

// ── Drag and drop ────────────────────────────────────────────────────────────
export async function mouseDrag(
    x1: number, y1: number,
    x2: number, y2: number
): Promise<string> {
    if (!(await isWithinScreenBounds(x1, y1)) || !(await isWithinScreenBounds(x2, y2))) {
        return `ERROR: Drag coordinates are outside the screen bounds.`;
    }
    await ps(`${WIN_API_CODE}
[WinInput]::SetCursorPos(${Math.round(x1)}, ${Math.round(y1)})
Start-Sleep -Milliseconds 60
[WinInput]::MouseClick([WinInput]::MOUSEEVENTF_LEFTDOWN, 0)
Start-Sleep -Milliseconds 80
$steps = 10
for ($i = 1; $i -le $steps; $i++) {
    $nx = [int](${Math.round(x1)} + ($i / $steps) * (${Math.round(x2)} - ${Math.round(x1)}))
    $ny = [int](${Math.round(y1)} + ($i / $steps) * (${Math.round(y2)} - ${Math.round(y1)}))
    [WinInput]::SetCursorPos($nx, $ny)
    Start-Sleep -Milliseconds 20
}
[WinInput]::MouseClick(0, [WinInput]::MOUSEEVENTF_LEFTUP)`);
    return `Dragged: (${Math.round(x1)},${Math.round(y1)}) → (${Math.round(x2)},${Math.round(y2)})`;
}

// ── Keyboard: VK code table ───────────────────────────────────────────────────
const VK_MAP: Record<string, number> = {
    enter: 0x0D, esc: 0x1B, tab: 0x09, space: 0x20,
    backspace: 0x08, delete: 0x2E, insert: 0x2D,
    home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22,
    up: 0x26, down: 0x28, left: 0x25, right: 0x27,
    f1: 0x70, f2: 0x71, f3: 0x72, f4: 0x73, f5: 0x74,
    f6: 0x75, f7: 0x76, f8: 0x77, f9: 0x78, f10: 0x79,
    f11: 0x7A, f12: 0x7B,
    ctrl: 0x11, alt: 0x12, shift: 0x10, win: 0x5B,
    a:0x41,b:0x42,c:0x43,d:0x44,e:0x45,f:0x46,g:0x47,h:0x48,
    i:0x49,j:0x4A,k:0x4B,l:0x4C,m:0x4D,n:0x4E,o:0x4F,p:0x50,
    q:0x51,r:0x52,s:0x53,t:0x54,u:0x55,v:0x56,w:0x57,x:0x58,
    y:0x59,z:0x5A,
    "0":0x30,"1":0x31,"2":0x32,"3":0x33,"4":0x34,
    "5":0x35,"6":0x36,"7":0x37,"8":0x38,"9":0x39,
};

// ── Keyboard shortcut (e.g. "ctrl+c", "alt+tab", "win+d") ────────────────────
export async function keyPress(keys: string): Promise<string> {
    const parts = keys.toLowerCase().split("+").map((k) => k.trim());
    const vks = parts.map((k) => VK_MAP[k] ?? parseInt(k, 16)).filter(Boolean);
    if (vks.length === 0) return `ERROR: Undefined key: "${keys}"`;

    const downCmds = vks.map((vk) => `[WinInput]::KeyEvent(${vk}, $false)`).join("\n");
    const upCmds = [...vks].reverse().map((vk) => `[WinInput]::KeyEvent(${vk}, $true)`).join("\n");

    await ps(`${WIN_API_CODE}
${downCmds}
Start-Sleep -Milliseconds 50
${upCmds}`);
    return `Key pressed: ${keys}`;
}

// ── Type text ─────────────────────────────────────────────────────────────────
export async function typeText(text: string): Promise<string> {
    if (!text) return "ERROR: Text is empty.";
    // Type via WScript.Shell SendKeys (limited special-character support)
    // Chunked for long text
    const escaped = text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '`"')
        .replace(/\{/g, "{{}}")
        .replace(/\}/g, "{}}")
        .replace(/\+/g, "{+}")
        .replace(/\^/g, "{^}")
        .replace(/%/g, "{%}")
        .replace(/~/g, "{~}");

    await ps(`$wsh = New-Object -ComObject WScript.Shell
$wsh.SendKeys("${escaped}")`);
    return `Typed: "${text.length > 50 ? text.slice(0, 50) + "..." : text}"`;
}

// ── Get screen size ───────────────────────────────────────────────────────────
export async function getScreenSize(): Promise<{width: number; height: number}> {
    const out = await ps(`${WIN_API_CODE}
"$([WinInput]::GetSystemMetrics(0))x$([WinInput]::GetSystemMetrics(1))"`);
    const match = out.match(/(\d+)x(\d+)/);
    if (match) return {width: parseInt(match[1]), height: parseInt(match[2])};
    return {width: 1920, height: 1080};
}
