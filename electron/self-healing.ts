/**
 * Faz 59 — Self-Healing: Tekrarlayan Hata Tanıma
 *
 * Loop-guard (Faz 53) AYNI çağrıyı tekrarı keser; ama bir tool FARKLI argümanlarla
 * da olsa hep AYNI hatayı veriyorsa (ör. her spotify_* çağrısı "Premium gerekiyor"
 * ile düşüyorsa) bu kör tekrardır — kök sebep aynıdır. Bu modül STM geçmişindeki
 * (tool-ailesi, hata-sınıfı) örüntüsünü tanır ve NET bir teşhis + strateji önerir.
 *
 * Saf fonksiyon — STM girişlerini alır, teşhis döndürür (Electron/IO bağımsız).
 * classifyError (Faz 56) ile hata sınıfını paylaşır.
 *
 * OpenJarvis `agents/errors.py` classify_error taksonomisinden ilham; trace-mining
 * ALINMADI.
 */

import {classifyError, type ErrorKind} from "./goal-executor";

export interface HealEntry {
    tool: string;
    success: boolean;
    result: string;
}

export interface Diagnosis {
    /** Tekrarlayan bir hata örüntüsü bulundu mu? */
    detected: boolean;
    /** Kaç kez tekrarladı. */
    count: number;
    /** Örüntünün hata sınıfı. */
    kind: ErrorKind | null;
    /** Tool ailesi (ön ek, ör. "spotify") — aynı domain tekrarını yakalamak için. */
    family: string | null;
    /** Modele/kullanıcıya sunulacak net teşhis + strateji (boş = yok). */
    advice: string;
}

const NONE: Diagnosis = {detected: false, count: 0, kind: null, family: null, advice: ""};

/** Tool ailesini çıkar: ilk "_" öncesi ("spotify_play" → "spotify"). */
function familyOf(tool: string): string {
    const i = tool.indexOf("_");
    return i > 0 ? tool.slice(0, i) : tool;
}

/** Aynı hata sınıfı için domain'e özgü, eyleme dönük teşhis cümlesi. */
function adviceFor(family: string, kind: ErrorKind, count: number): string {
    const base = `"${family}" ile ${count} kez aynı tür hata (${kind}) aldım — kör tekrar yerine durum değişti.`;
    const hint: Partial<Record<ErrorKind, string>> = {
        permission: `Bu bir yetki/erişim sorunu (ör. ${family === "spotify" ? "Spotify Premium / yeniden yetkilendirme" : "eksik anahtar/izin"}). Tekrar denemek çözmez; kullanıcıya gerekli erişimi söyle.`,
        not_found: `Hedef bulunamıyor. Aynı isim/yolla tekrar etme; adı doğrula, alternatif kaynak dene veya kullanıcıdan netleştirme iste.`,
        transient: `Geçici sorun ısrar ediyor (ağ/servis). Bir süre sonra denenebilir; şimdilik durup kullanıcıya bağlantı/servis durumunu öner.`,
        invalid_args: `Argüman biçimi sürekli reddediliyor. Şemayı/biçimi gözden geçir; farklı bir parametre kombinasyonu dene.`,
        fatal: `Toparlanamayan bir hata sürüyor. Görevi durdur ve net teşhisi kullanıcıya ilet.`,
        blocked: `Eylem tekrar tekrar engelleniyor (izin/döngü). Yaklaşımı değiştir veya kullanıcı onayı iste.`,
    };
    return `${base} ${hint[kind] ?? "Yaklaşımı değiştir veya kullanıcıya danış."}`;
}

/**
 * STM geçmişinde tekrarlayan hata örüntüsü ara. Aynı tool AİLESİNİN aynı hata
 * SINIFIYLA `threshold` (varsayılan 3) veya daha çok başarısız olduğu durumu yakalar.
 * En son hatalardan geriye doğru bakar; ilk eşleşen örüntüyü döndürür.
 */
export function diagnose(recent: HealEntry[], threshold = 3): Diagnosis {
    // (family + kind) → sayaç
    const counts = new Map<string, {family: string; kind: ErrorKind; n: number}>();
    for (const e of recent) {
        if (e.success) continue;
        const v = classifyError(e.result);
        if (!v.isError) continue;
        const family = familyOf(e.tool);
        const key = `${family}::${v.kind}`;
        const cur = counts.get(key) ?? {family, kind: v.kind, n: 0};
        cur.n++;
        counts.set(key, cur);
    }
    let worst: {family: string; kind: ErrorKind; n: number} | null = null;
    for (const v of counts.values()) {
        if (v.n >= threshold && (!worst || v.n > worst.n)) worst = v;
    }
    if (!worst) return NONE;
    return {
        detected: true,
        count: worst.n,
        kind: worst.kind,
        family: worst.family,
        advice: adviceFor(worst.family, worst.kind, worst.n),
    };
}
