// AEGIS — Mod Seçim Ekranı (Faz 30.4)
// İlk açılışta: "Hızlı Başlangıç (Deneme)" vs "Gelişmiş Kurulum (Kendi Anahtarların)".

const CYAN = "34,211,238";
const ac = `rgb(${CYAN})`;

interface Props {
    onSelect: (mode: "trial" | "own") => void;
}

export default function ModeSelectScreen({onSelect}: Props) {
    return (
        <div
            className="h-screen w-screen flex flex-col"
            style={{
                background: "#03060c",
                color: ac,
                fontFamily: "'JetBrains Mono', monospace",
                WebkitFontSmoothing: "antialiased",
            } as React.CSSProperties}
        >
            <div className="drag h-9 shrink-0 flex items-center justify-between px-5">
                <span className="text-[11px] tracking-[0.45em]" style={{fontFamily: "Orbitron, sans-serif", color: ac, opacity: 0.6}}>
                    AEGIS
                </span>
                <button
                    className="no-drag w-7 h-7 grid place-items-center opacity-40 hover:opacity-100 transition text-sm"
                    style={{color: ac}}
                    onClick={() => window.jarvis.close()}
                >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col">
                <div className="mb-8">
                    <div className="text-2xl" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>
                        AEGIS'e Hoş Geldin
                    </div>
                    <p className="text-[12.5px] mt-2 leading-relaxed" style={{color: ac, opacity: 0.5}}>
                        Nasıl başlamak istersin? Bunu sonradan ayarlardan değiştirebilirsin.
                    </p>
                </div>

                <div className="flex flex-col gap-4 flex-1">
                    {/* Hızlı Başlangıç */}
                    <button
                        onClick={() => onSelect("trial")}
                        className="text-left rounded-2xl border p-5 transition hover:brightness-125 group"
                        style={{borderColor: `rgba(${CYAN},0.35)`, background: `rgba(${CYAN},0.06)`}}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">⚡</span>
                            <span className="text-[15px] tracking-wide" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>
                                Hızlı Başlangıç
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto" style={{background: `rgba(${CYAN},0.15)`, color: ac}}>
                                ÖNERİLEN
                            </span>
                        </div>
                        <p className="text-[12px] leading-relaxed" style={{color: ac, opacity: 0.65}}>
                            Hemen dene — API anahtarı gerekmez. Sadece bir hesap oluştur, çalışmaya başla.
                            Günlük kullanım sınırı vardır.
                        </p>
                    </button>

                    {/* Gelişmiş Kurulum */}
                    <button
                        onClick={() => onSelect("own")}
                        className="text-left rounded-2xl border p-5 transition hover:brightness-125"
                        style={{borderColor: `rgba(${CYAN},0.18)`, background: `rgba(${CYAN},0.02)`}}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">🔑</span>
                            <span className="text-[15px] tracking-wide" style={{fontFamily: "Orbitron, sans-serif", color: ac}}>
                                Gelişmiş Kurulum
                            </span>
                        </div>
                        <p className="text-[12px] leading-relaxed" style={{color: ac, opacity: 0.65}}>
                            Kendi AI sağlayıcını seç (Groq, OpenAI, Anthropic…) ve kendi API anahtarınla kullan.
                            Sınır yok. Giriş yapmak opsiyoneldir (ayarları cihazlar arası senkronlamak için).
                        </p>
                    </button>
                </div>
            </div>
        </div>
    );
}
