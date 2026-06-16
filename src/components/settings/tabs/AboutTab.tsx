import {useEffect, useState} from "react";
import type {Lang, SettingsStrings} from "../../../i18n";
import {CHANGELOG} from "../../../changelog";

interface Props {
    accent: string;
    ac: string;
    lang: Lang;
    s: SettingsStrings;
}

function formatBytes(b: number) {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bps: number) {
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

// Module-level: tab unmount olsa bile güncelleme durumu korunur
type UpdateStatus = "idle" | "checking" | "uptodate" | "available" | "downloading" | "ready" | "error";
type UpdateProgress = {percent: number; transferred: number; total: number; bytesPerSecond: number};
let _gStatus: UpdateStatus = "idle";
let _gLatest: string | null = null;
let _gProgress: UpdateProgress | null = null;
let _gError = "";
let _gListening = false;

function ensureGlobalListeners() {
    if (_gListening) return;
    _gListening = true;
    window.jarvis.on("update-progress", (p: UpdateProgress) => { _gStatus = "downloading"; _gProgress = p; });
    window.jarvis.on("update-downloaded",               ()              => { _gStatus = "ready"; _gProgress = null; });
    // İndirme sürerken (veya bittikten sonra) gelen "update-available"i yoksay: performDownload
    // indirmeden önce tekrar checkForUpdates yapıyor, bu da bu event'i yeniden tetikleyip
    // durumu "downloading"den "available"a geri çeviriyordu (indir butonu geri geliyordu).
    window.jarvis.on("update-available",  (info: {version: string})    => { _gLatest = info.version; if (_gStatus !== "downloading" && _gStatus !== "ready") _gStatus = "available"; });
    window.jarvis.on("update-error",      (e: {message: string})       => { _gStatus = "error"; _gError = e?.message ?? "Güncelleme hatası"; _gProgress = null; });
}

export default function AboutTab({accent: a, ac, lang, s}: Props) {
    const [version, setVersion] = useState<string>("…");
    const [status, setStatus] = useState<UpdateStatus>(_gStatus);
    const [latestVersion, setLatestVersion] = useState<string | null>(_gLatest);
    const [errorMsg, setErrorMsg] = useState(_gError);
    const [progress, setProgress] = useState<UpdateProgress | null>(_gProgress);

    useEffect(() => {
        window.jarvis.getAppVersion().then(setVersion).catch(() => setVersion("?"));
        ensureGlobalListeners();

        const offProgress = window.jarvis.on("update-progress", (p: UpdateProgress) => {
            setProgress(p);
            setStatus("downloading");
        });
        const offDone = window.jarvis.on("update-downloaded", () => {
            setStatus("ready");
            setProgress(null);
        });
        const offAvail = window.jarvis.on("update-available", (info: {version: string}) => {
            setLatestVersion(info.version);
            // İndirme/kurulum sürerken gelen re-check event'i durumu geri çevirmesin.
            setStatus((prev) => (prev === "downloading" || prev === "ready" ? prev : "available"));
        });
        const offErr = window.jarvis.on("update-error", (e: {message: string}) => {
            setErrorMsg(e?.message ?? "Güncelleme hatası");
            setStatus("error");
            setProgress(null);
        });

        return () => { offProgress(); offDone(); offAvail(); offErr(); };
    }, []);

    async function checkUpdates() {
        setStatus("checking");
        setErrorMsg("");
        setProgress(null);
        try {
            const r = await window.jarvis.checkForUpdates();
            if (r.dev) { setStatus("uptodate"); return; }
            if (r.error) { setErrorMsg(r.error); setStatus("error"); return; }
            if (r.hasUpdate && r.latest) {
                setLatestVersion(r.latest);
                setStatus("available");
            } else {
                setStatus("uptodate");
            }
        } catch (e: any) {
            setErrorMsg(e.message ?? "Bilinmeyen hata");
            setStatus("error");
        }
    }

    const row = "flex items-center justify-between py-3";
    const label = `text-[12px] tracking-wide`;
    const value = `text-[12px] font-mono`;
    const divider = `border-t`;

    return (
        <div className="space-y-6 max-w-md">
            {/* Sürüm bilgisi */}
            <div className="rounded-xl p-5 space-y-0"
                style={{background: `rgba(${a},0.04)`, border: `1px solid rgba(${a},0.1)`}}>
                <div className={row}>
                    <span className={label} style={{color: `rgba(${a},0.5)`}}>Uygulama</span>
                    <span className={value} style={{color: ac}}>AEGIS</span>
                </div>
                <div className={`${row} ${divider}`} style={{borderColor: `rgba(${a},0.07)`}}>
                    <span className={label} style={{color: `rgba(${a},0.5)`}}>Sürüm</span>
                    <span className={value} style={{color: ac}}>v{version}</span>
                </div>
                <div className={`${row} ${divider}`} style={{borderColor: `rgba(${a},0.07)`}}>
                    <span className={label} style={{color: `rgba(${a},0.5)`}}>Platform</span>
                    <span className={value} style={{color: `rgba(${a},0.7)`}}>Windows</span>
                </div>
            </div>

            {/* Güncelleme */}
            <div className="space-y-3">
                <button
                    onClick={checkUpdates}
                    disabled={status === "checking" || status === "downloading" || status === "ready"}
                    className="w-full py-2.5 rounded-xl text-[12px] tracking-widest transition hover:brightness-125 disabled:opacity-50"
                    style={{background: `rgba(${a},0.08)`, border: `1px solid rgba(${a},0.2)`, color: ac}}
                >
                    {status === "checking" ? "KONTROL EDİLİYOR…" : "GÜNCELLEMELERİ DENETLE"}
                </button>

                {status === "uptodate" && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px]"
                        style={{background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)", color: "rgba(74,222,128,0.9)"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        En güncel sürüm yüklü.
                    </div>
                )}

                {(status === "available" || status === "downloading") && latestVersion && (
                    <div className="rounded-xl overflow-hidden"
                        style={{background: `rgba(${a},0.06)`, border: `1px solid rgba(${a},0.2)`}}>
                        {/* Başlık */}
                        <div className="flex items-center justify-between px-4 py-2.5 text-[12px]" style={{color: ac}}>
                            <span>v{latestVersion} mevcut{status === "downloading" ? " — indiriliyor…" : ""}</span>
                            {status === "available" && (
                                <button
                                    onClick={() => { setStatus("downloading"); window.jarvis.updateDownload(); }}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg transition hover:brightness-125"
                                    style={{background: `rgba(${a},0.15)`, border: `1px solid rgba(${a},0.35)`, color: ac}}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 2v10m0 0-3-3m3 3 3-3M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
                                    </svg>
                                    İNDİR
                                </button>
                            )}
                        </div>

                        {/* Progress bar */}
                        {status === "downloading" && progress && (
                            <div className="px-4 pb-3 space-y-1.5">
                                <div className="w-full h-1 rounded-full overflow-hidden" style={{background: `rgba(${a},0.15)`}}>
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{width: `${progress.percent}%`, background: ac}}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px]" style={{color: `rgba(${a},0.45)`}}>
                                    <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
                                    <span>{formatSpeed(progress.bytesPerSecond)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {status === "ready" && (
                    <div className="rounded-xl overflow-hidden"
                        style={{background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)"}}>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 text-[12px]" style={{color: "rgba(74,222,128,0.9)"}}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                İndirildi — yeniden başlatınca kurulacak.
                            </div>
                            <button
                                onClick={() => window.jarvis.updateInstall()}
                                className="text-[11px] px-3 py-1 rounded-lg transition hover:brightness-125"
                                style={{background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "rgba(74,222,128,0.9)"}}>
                                ŞİMDİ KAPAT
                            </button>
                        </div>
                    </div>
                )}

                {status === "error" && (
                    <div className="px-4 py-2.5 rounded-xl text-[12px]"
                        style={{background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.9)"}}>
                        Hata: {errorMsg}
                    </div>
                )}
            </div>

            {/* Yama notları / Patch notes — aktif dile göre */}
            <div className="space-y-3">
                <div className="text-[11px] tracking-widest uppercase" style={{color: `rgba(${a},0.45)`}}>
                    {s.aboutChangelog}
                </div>
                <div className="space-y-3">
                    {CHANGELOG.map((entry) => {
                        const isCurrent = entry.version === version;
                        const notes = entry.notes[lang] ?? entry.notes.en;
                        const dateStr = (() => {
                            try { return new Date(entry.date).toLocaleDateString(lang, {year: "numeric", month: "short", day: "numeric"}); }
                            catch { return entry.date; }
                        })();
                        return (
                            <div key={entry.version} className="rounded-xl p-4"
                                style={{background: `rgba(${a},0.04)`, border: `1px solid rgba(${a},${isCurrent ? 0.25 : 0.1})`}}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-mono" style={{color: ac}}>v{entry.version}</span>
                                        {isCurrent && (
                                            <span className="text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded"
                                                style={{background: `rgba(${a},0.15)`, color: ac}}>
                                                {s.aboutCurrent}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono" style={{color: `rgba(${a},0.4)`}}>{dateStr}</span>
                                </div>
                                <ul className="space-y-1.5">
                                    {notes.map((n, i) => (
                                        <li key={i} className="flex gap-2 text-[11px] leading-relaxed" style={{color: `rgba(${a},0.7)`}}>
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2.5"
                                                className="mt-0.5 shrink-0" style={{opacity: 0.6}}>
                                                <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                            <span>{n}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
