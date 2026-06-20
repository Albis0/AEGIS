/**
 * Faz 60 — Computer Use Doğrulama Döngüsü
 *
 * Faz 47 computer-use KÖR koordinat tıklamasıdır: tıklar ve sonucu görmez. Hedef
 * kaymışsa (pencere taşınmış, layout değişmiş) sessizce yanlış yere tıklar. Bu modül
 * "tıkla → ekran değişti mi DOĞRULA → değişmediyse fark et" döngüsünün saf çekirdeğini
 * sağlar: iki ekran görüntüsünü karşılaştırıp eylemin BİR ETKİ yapıp yapmadığını söyler.
 *
 * Saf fonksiyonlar (Electron/IO bağımsız). Gerçek screenshot main.ts callback'inden
 * gelir; burada yalnız hash + karşılaştırma + karar mantığı vardır → test edilebilir.
 *
 * OpenJarvis `tools/browser_axtree.py` (koordinat yerine semantik) ruhundan ilham;
 * tam UIAutomation element-tree opsiyonel/sonraya bırakıldı (NICE-TO-HAVE).
 */

/**
 * Bir base64 görüntüden hafif, deterministik bir imza üretir. Kriptografik değil —
 * amaç "iki kare aynı mı / ne kadar farklı mı"yı ucuza ölçmek. Görüntüyü sabit
 * sayıda parçaya böler, her parçanın karakter-toplamını alır → parça-imza dizisi.
 * Böylece kısmi değişim (tek bölge) de yakalanır, tüm-kare hash'inden daha bilgilendirici.
 */
export function frameSignature(base64: string, buckets = 16): number[] {
    const sig = new Array(buckets).fill(0);
    if (!base64) return sig;
    const len = base64.length;
    const span = Math.max(1, Math.floor(len / buckets));
    for (let i = 0; i < len; i++) {
        const b = Math.min(buckets - 1, Math.floor(i / span));
        // ucuz, sıralı-duyarlı karışım
        sig[b] = (sig[b] * 31 + base64.charCodeAt(i)) >>> 0;
    }
    return sig;
}

/**
 * İki imza arasındaki normalize farkı [0..1]. 0 = aynı, 1 = tüm parçalar farklı.
 * (Parça eşitliği oranı üzerinden — gürültüye dayanıklı, eşik koymaya uygun.)
 */
export function signatureDiff(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;
    let diff = 0;
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) diff++;
    return diff / n;
}

export interface VerifyResult {
    /** Eylem ekranda gözle görülür bir değişiklik yaptı mı? */
    changed: boolean;
    /** Normalize fark miktarı [0..1]. */
    diff: number;
    /** Modele/kullanıcıya sunulacak kısa Türkçe rapor. */
    note: string;
}

/**
 * Eylem öncesi/sonrası iki kareyi karşılaştırıp etkiyi raporlar. `threshold` altı
 * fark = "değişmedi" (muhtemelen tıklama hedefi ıskaladı). `changed=false` olunca
 * çağıran taraf yeniden deneyebilir veya durup sorabilir.
 */
export function verifyChange(beforeB64: string, afterB64: string, threshold = 1 / 16): VerifyResult {
    // Screenshot alınamadıysa (boş) doğrulama yapılamaz → "bilinmiyor" yerine
    // güvenli varsayım: değişmiş kabul etme, ama net not düş.
    if (!beforeB64 || !afterB64) {
        return {changed: false, diff: 0, note: "Doğrulama yapılamadı (ekran görüntüsü alınamadı)."};
    }
    const diff = signatureDiff(frameSignature(beforeB64), frameSignature(afterB64));
    const changed = diff >= threshold;
    const note = changed
        ? `Eylem sonrası ekran değişti (fark %${Math.round(diff * 100)}) — işlem etki etti.`
        : `Eylem sonrası ekran neredeyse değişmedi (fark %${Math.round(diff * 100)}) — tıklama hedefi ıskalamış olabilir; koordinatı doğrula veya yeniden dene.`;
    return {changed, diff, note};
}

/**
 * Doğrulamalı eylem akışını koordine eden yardımcı. `snapshot` gerçek ekran
 * görüntüsünü (base64) döndüren callback; `doAction` eylemi yürüten callback.
 * Sıra: kare-al → eylem → kare-al → karşılaştır. Eylem sonucu + doğrulama notu döner.
 */
export async function actWithVerification(
    snapshot: () => Promise<string>,
    doAction: () => Promise<string>,
    threshold = 1 / 16,
): Promise<{actionResult: string; verify: VerifyResult}> {
    const before = await snapshot().catch(() => "");
    const actionResult = await doAction();
    const after = await snapshot().catch(() => "");
    const verify = verifyChange(before, after, threshold);
    return {actionResult, verify};
}
