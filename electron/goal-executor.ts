/**
 * Faz 56 — Goal Executor: Plan → Adım → Doğrula → Toparla
 *
 * `agent_run` şu ana kadar "8 adım dene, olmazsa pes"ti: plan yok, ara-doğrulama
 * yok, takılınca toparlama yok. Bu modül çok-adımlı görev yürütmenin DOĞRULAMA ve
 * TOPARLAMA çekirdeğini sağlar (saf fonksiyonlar — Electron/IO bağımsız):
 *
 *   1. classifyError  — bir tool sonucunu hata TAKSONOMİSİNE atar (kör tekrar yerine
 *                       strateji değişimi: yeniden dene / argüman düzelt / vazgeç)
 *   2. verifyStep     — adım sonucunun "ilerleme" mi yoksa "tıkanma" mı olduğunu söyler
 *   3. buildPlanPrompt— hedefi plan-temelli bir ajan promptuna çevirir (adım + doğrulama)
 *
 * OpenJarvis `agents/executor.py` error taxonomy'sinden (classify_error/retry/
 * escalate/fatal) sadeleştirilerek alındı. Meta-planner ALINMADI.
 */

/** Bir tool sonucunun hata sınıfı. */
export type ErrorKind =
    | "ok"          // başarı — sonuç hata değil
    | "transient"   // geçici (ağ/zaman aşımı/meşgul) → YENİDEN DENE mantıklı
    | "permission"  // yetki/izin reddi → yeniden deneme anlamsız; kullanıcıya sor
    | "not_found"   // hedef yok (dosya/cihaz/oyun) → argümanı/hedefi DEĞİŞTİR
    | "invalid_args"// argüman/şema hatası → argümanı DÜZELT, aynısıyla tekrar etme
    | "blocked"     // loop-guard / izin kapısı / devre dışı → durumu kabul et, dur
    | "fatal";      // toparlanamaz → görevi sonlandır, net teşhis ver

export interface ErrorVerdict {
    kind: ErrorKind;
    /** Bu sonuç bir hata mı? (kind !== "ok") */
    isError: boolean;
    /** Aynı çağrıyı tekrar denemek mantıklı mı? */
    retriable: boolean;
    /** Modele/kullanıcıya verilecek kısa Türkçe yönlendirme. */
    advice: string;
}

// Sonuç metninde aranan desenler (executeTool/tool sonuçları Türkçe + İngilizce karışık).
const PATTERNS: {kind: ErrorKind; re: RegExp; retriable: boolean; advice: string}[] = [
    {kind: "blocked", re: /^ENGELLENDI|loop koruması|döngü koruması|kullanıcı onayı reddedildi|devre dışı/i,
        retriable: false, advice: "Eylem engellendi (döngü/izin/devre dışı). Tekrar deneme; kullanıcıya durumu açıkla."},
    {kind: "permission", re: /\b(401|403|unauthorized|forbidden|yetki|izin yok|permission denied|access denied|premium gerek)/i,
        retriable: false, advice: "Yetki/izin sorunu. Yeniden deneme; gerekli erişim/anahtar için kullanıcıya sor."},
    {kind: "not_found", re: /\b(404|not found|bulunamadı|yok\b|mevcut değil|no such|tanımlı değil|geçersiz oyun|cihaz yok)/i,
        retriable: false, advice: "Hedef bulunamadı. Aynı argümanla tekrar etme; adı/yolu/hedefi düzelt veya alternatif dene."},
    {kind: "invalid_args", re: /\b(geçersiz|invalid|bad request|400|422|eksik (parametre|argüman)|yanlış format|parse)/i,
        retriable: false, advice: "Argüman/şema hatası. Aynı argümanları gönderme; düzeltip dene."},
    {kind: "transient", re: /\b(zaman aşımı|timeout|econn|etimedout|503|502|429|rate limit|geçici|temporarily|meşgul|busy|try again)/i,
        retriable: true, advice: "Geçici hata. Kısa bekleyip BİR kez daha denemek mantıklı."},
    {kind: "fatal", re: /^HATA|^Araç hatası|çalışırken hata|crash|fatal|exception/i,
        retriable: false, advice: "Toparlanamaz hata. Görevi durdur ve net bir teşhis sun."},
];

/**
 * Bir tool sonucunu hata taksonomisine atar. Sonuç başarılıysa kind="ok".
 * Eşleşme sırası önemlidir (en özelden gevşeğe): blocked > permission > not_found
 * > invalid_args > transient > fatal.
 */
export function classifyError(result: string): ErrorVerdict {
    const text = String(result ?? "");
    for (const p of PATTERNS) {
        if (p.re.test(text)) {
            return {kind: p.kind, isError: true, retriable: p.retriable, advice: p.advice};
        }
    }
    return {kind: "ok", isError: false, retriable: false, advice: ""};
}

/**
 * Adım doğrulama: bir adımın sonucu görevi ileri taşıdı mı, yoksa tıkandı mı?
 * "progress" → devam et; "stuck" → strateji değiştir (advice'a göre); "fail" → dur.
 */
export interface StepVerdict {
    status: "progress" | "retry" | "stuck" | "fail";
    advice: string;
}

export function verifyStep(result: string): StepVerdict {
    const v = classifyError(result);
    if (!v.isError) return {status: "progress", advice: ""};
    if (v.retriable) return {status: "retry", advice: v.advice};
    if (v.kind === "fatal" || v.kind === "blocked") return {status: "fail", advice: v.advice};
    return {status: "stuck", advice: v.advice};
}

/**
 * Hedefi plan-temelli bir ajan promptuna çevirir. Düz "adım adım yap"tan farkı:
 * modelden ÖNCE kısa bir plan, her adımdan SONRA doğrulama ve takılınca alternatif
 * istenir (Faz 53 loop-guard + Faz 54 izin kapısı zaten döngüde devrede).
 */
export function buildPlanPrompt(goal: string, maxSteps: number): string {
    return [
        `[AJAN MODU — PLANLA, YAP, DOĞRULA · maks ${maxSteps} adım]`,
        `Hedef: ${goal}`,
        ``,
        `Çalışma biçimin:`,
        `1) Önce hedefi 2-5 somut adıma böl ve kısaca planı yaz.`,
        `2) Her adımı uygun araçla yap. Adımdan sonra sonucu KONTROL et:`,
        `   - Başarılıysa sıradaki adıma geç.`,
        `   - Hedef bulunamadıysa (dosya/cihaz/oyun yok) AYNI argümanı tekrar deneme; adı/yolu düzelt veya alternatif dene.`,
        `   - Yetki/izin hatasıysa tekrar deneme; kullanıcıya neyin gerektiğini söyle.`,
        `   - Geçici hata (zaman aşımı/meşgul) ise en fazla BİR kez daha dene.`,
        `3) Bir adımda takılır ve ilerleyemezsen DUR; ne yaptığını, nerede takıldığını ve önerini özetle. Sonsuz deneme yapma.`,
        `4) Bitince kısa bir kapanış özeti ver (ne yapıldı / ne yapılamadı).`,
    ].join("\n");
}
