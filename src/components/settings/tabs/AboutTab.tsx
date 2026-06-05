import {useEffect, useState} from "react";

interface Props {
    accent: string;
    ac: string;
}

export default function AboutTab({accent: a, ac}: Props) {
    const [version, setVersion] = useState<string>("…");
    const [status, setStatus] = useState<"idle" | "checking" | "uptodate" | "available" | "error">("idle");
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        window.jarvis.getAppVersion().then(setVersion).catch(() => setVersion("?"));
    }, []);

    async function checkUpdates() {
        setStatus("checking");
        setErrorMsg("");
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
                    disabled={status === "checking"}
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

                {status === "available" && (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-[12px]"
                        style={{background: `rgba(${a},0.08)`, border: `1px solid rgba(${a},0.25)`, color: ac}}>
                        <span>v{latestVersion} mevcut — indiriliyor…</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v10m0 0-3-3m3 3 3-3M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
                        </svg>
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
