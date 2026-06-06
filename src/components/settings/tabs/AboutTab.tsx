import {useEffect, useState} from "react";

interface Props {
    accent: string;
    ac: string;
}

function formatBytes(b: number) {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bps: number) {
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

export default function AboutTab({accent: a, ac}: Props) {
    const [version, setVersion] = useState<string>("…");
    const [status, setStatus] = useState<"idle" | "checking" | "uptodate" | "available" | "downloading" | "ready" | "error">("idle");
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [progress, setProgress] = useState<{percent: number; transferred: number; total: number; bytesPerSecond: number} | null>(null);

    useEffect(() => {
        window.jarvis.getAppVersion().then(setVersion).catch(() => setVersion("?"));

        const offProgress = window.jarvis.on("update-progress", (p) => {
            setProgress(p);
            setStatus("downloading");
        });
        const offDone = window.jarvis.on("update-downloaded", () => {
            setStatus("ready");
            setProgress(null);
        });
        const offAvail = window.jarvis.on("update-available", (info) => {
            setLatestVersion(info.version);
            setStatus("available");
        });

        return () => { offProgress(); offDone(); offAvail(); };
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
        </div>
    );
}
