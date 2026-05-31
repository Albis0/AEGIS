import React, {useEffect, useRef, useState} from "react";

interface Command {
    id: string;
    label: string;
    description: string;
    text: string;
    direct: boolean;
}

const COMMANDS: Command[] = [
    {id: "screenshot",     label: "Ekranı analiz et",              description: "Tam ekran yakala + vision ile analiz",     text: "Ekranımda ne var?",                            direct: true},
    {id: "clipboard_r",   label: "Panoyu oku",                    description: "Panodaki mevcut metni göster",             text: "Panodaki metni oku",                           direct: true},
    {id: "windows",        label: "Açık pencereleri listele",      description: "Tüm açık uygulama pencerelerini göster",   text: "Açık pencereleri listele",                     direct: true},
    {id: "weather",        label: "Hava durumu",                   description: "Konumunuzun güncel hava durumu",           text: "Hava durumu nasıl?",                           direct: true},
    {id: "profile",        label: "Profilimi göster",              description: "Kaydedilmiş kullanıcı bilgileri",          text: "Profilimi göster",                             direct: true},
    {id: "notes",          label: "Notlarımı göster",              description: "Bekleyen notlar ve hatırlatıcılar",        text: "Notlarımı göster",                             direct: true},
    {id: "app_profiles",   label: "Uygulama profillerini listele", description: "Kayıtlı app başlatma profilleri",          text: "Uygulama profillerini listele",                direct: true},
    {id: "plugins",        label: "Plugin'leri listele",           description: "Yüklü plugin'ler ve araçları",             text: "Plugin'leri listele",                          direct: true},
    {id: "reload_plugins", label: "Plugin'leri yenile",            description: "~/.aegis/plugins/ diskten yeniden yükle", text: "Plugin'leri yenile",                           direct: true},
    {id: "fetch_url",      label: "Web sayfasını oku",             description: "URL'nin içeriğini çek ve özetle",         text: "Bu sayfayı oku: https://",                     direct: false},
    {id: "volume",         label: "Ses seviyesini ayarla",         description: "Sistem ses seviyesi 0-100",               text: "Sesi %50 yap",                                 direct: false},
    {id: "brightness",     label: "Parlaklığı ayarla",             description: "Ekran parlaklığı 0-100",                  text: "Parlaklığı %50 yap",                           direct: false},
    {id: "remind",         label: "Hatırlatıcı ayarla",            description: "X dakika/saniye sonra sesli hatırlat",    text: "10 dakika sonra hatırlat: ",                   direct: false},
    {id: "note_save",      label: "Not kaydet",                    description: "Yeni not ekle (Supabase'e)",              text: "Not kaydet: ",                                 direct: false},
    {id: "search",         label: "İnternette ara",                description: "Tavily/Serper/DuckDuckGo ile ara",        text: "Ara: ",                                        direct: false},
    {id: "notif",          label: "Bildirim gönder",               description: "Windows toast bildirimi göster",          text: "Bildirim gönder başlık: AEGIS mesaj: Merhaba", direct: false},
    {id: "focus",          label: "Pencereyi öne getir",           description: "Uygulamayı aktif pencere yap",            text: "Öne getir: ",                                  direct: false},
    {id: "clip_write",     label: "Panoya yaz",                    description: "Metni panonuza kopyala",                  text: "Panoya kopyala: ",                             direct: false},
    {id: "run_profile",    label: "Profil çalıştır",               description: "Kayıtlı uygulama profili başlat",         text: "Profili çalıştır: ",                           direct: false},
];

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (text: string, direct: boolean) => void;
}

export default function CommandPalette({open, onClose, onSelect}: Props) {
    const [query, setQuery] = useState("");
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery("");
            setCursor(0);
            setTimeout(() => inputRef.current?.focus(), 40);
        }
    }, [open]);

    const filtered = query.trim()
        ? COMMANDS.filter((c) =>
            c.label.toLowerCase().includes(query.toLowerCase()) ||
            c.description.toLowerCase().includes(query.toLowerCase()))
        : COMMANDS;

    useEffect(() => { setCursor(0); }, [query]);

    if (!open) return null;

    const select = (cmd: Command) => {
        onSelect(cmd.text, cmd.direct);
        onClose();
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") { onClose(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
        if (e.key === "Enter" && filtered[cursor]) { e.preventDefault(); select(filtered[cursor]); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div
                className="relative w-[clamp(340px,44vw,540px)] rounded-xl border overflow-hidden"
                style={{
                    background: "rgba(4,7,13,0.98)",
                    borderColor: "rgba(var(--hud),0.35)",
                    boxShadow: "0 0 40px rgba(var(--hud),0.12), 0 25px 60px rgba(0,0,0,0.85)",
                }}
                onKeyDown={handleKey}
            >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{borderColor: "rgba(var(--hud),0.2)"}}>
                    <span className="text-xs opacity-40" style={{color: "rgb(var(--hud))"}}>⌘</span>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Komut ara…"
                        className="flex-1 bg-transparent outline-none text-sm font-mono"
                        style={{color: "rgb(var(--hud-soft))", caretColor: "rgb(var(--hud))"}}
                    />
                    <kbd className="text-[9px] opacity-25 px-1.5 py-0.5 rounded border" style={{color: "rgb(var(--hud))", borderColor: "rgba(var(--hud),0.3)"}}>ESC</kbd>
                </div>

                {/* Command list */}
                <div className="max-h-[52vh] overflow-y-auto">
                    {filtered.length === 0 && (
                        <div className="px-4 py-6 text-[11px] opacity-30 text-center" style={{color: "rgb(var(--hud))"}}>komut bulunamadı</div>
                    )}
                    {filtered.map((cmd, i) => (
                        <div
                            key={cmd.id}
                            className="flex items-center gap-3 px-4 py-2 cursor-pointer transition"
                            style={{background: i === cursor ? "rgba(var(--hud),0.1)" : "transparent"}}
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => select(cmd)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-mono" style={{color: "rgb(var(--hud-soft))"}}>{cmd.label}</div>
                                <div className="text-[9.5px] opacity-45 truncate" style={{color: "rgb(var(--hud))"}}>{cmd.description}</div>
                            </div>
                            <span
                                className="shrink-0 text-[8px] px-1.5 py-0.5 rounded tracking-widest"
                                style={{
                                    color: cmd.direct ? "rgb(var(--status-ok))" : "rgb(var(--hud))",
                                    background: cmd.direct ? "rgb(var(--status-ok) / 0.1)" : "rgba(var(--hud),0.08)",
                                    border: `1px solid ${cmd.direct ? "rgb(var(--status-ok) / 0.25)" : "rgba(var(--hud),0.2)"}`,
                                }}
                            >
                                {cmd.direct ? "ANLIK" : "DÜZENLE"}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex gap-4 px-4 py-1.5 border-t text-[8.5px] opacity-30" style={{borderColor: "rgba(var(--hud),0.15)", color: "rgb(var(--hud))"}}>
                    <span>↑↓ gezin</span>
                    <span>↵ seç</span>
                    <span>ESC kapat</span>
                    <span className="ml-auto">Ctrl+Space açar</span>
                </div>
            </div>
        </div>
    );
}
