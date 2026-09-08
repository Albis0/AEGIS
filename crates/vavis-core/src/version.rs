//! Sürüm karşılaştırma ve güncelleme kararı.
//!
//! # Burada ne var, ne yok
//!
//! Burada **ağ yok**. Yalnızca iki sürüm dizesini karşılaştırma ve "bu
//! güncelleme gerekli mi" kararı var. Ağ işini kabuk yapıyor: çekirdek
//! katmanının HTTP istemcisi yok ve olmaması onu test edilebilir tutuyor —
//! aşağıdaki kararların hiçbiri internet gerektirmeden doğrulanabiliyor.
//!
//! # Neden kendi karşılaştırmamız
//!
//! `"0.10.0" > "0.9.0"` metin olarak **yanlış**: `'1' < '9'`. Sürümler
//! parçalara ayrılıp sayı olarak karşılaştırılmalı. Bu, sürüm karşılaştırmayı
//! elle yazan herkesin er geç yaptığı hata, ve sonucu sessiz: kullanıcı
//! 0.10.0 çıktığında 0.9.0'da kalır ve hiçbir uyarı görmez.

use std::cmp::Ordering;

/// Ayrıştırılmış anlamsal sürüm.
///
/// Ön sürüm etiketi (`-beta.1`) **taşınıyor ama karşılaştırmada göz ardı
/// ediliyor**: bu uygulamanın ön sürüm yayın akışı yok, ve yarım bir
/// uygulama sessizce yanlış davranmaktansa açıkça yok sayması iyi.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Version {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl Version {
    /// `"0.7.4"` ya da `"v0.7.4"` ayrıştırır.
    ///
    /// Etiketler `v` önekiyle geliyor (`v0.7.4`), dosyadaki sürümlerde ise
    /// önek yok. İkisini de kabul etmek, çağıranın her seferinde kırpmasını
    /// gerektirmiyor — ve kırpmayı unutan çağıran sessizce hiç güncelleme
    /// bulamazdı.
    pub fn parse(text: &str) -> Option<Self> {
        let text = text.trim();
        let text = text.strip_prefix('v').unwrap_or(text);
        // Yayın etiketinde bazen "0.7.4-beta" gibi bir ek oluyor.
        let core = text.split(['-', '+']).next()?;

        let mut parts = core.split('.');
        let major = parts.next()?.parse().ok()?;
        let minor = parts.next()?.parse().ok()?;
        // Yama numarası yoksa sıfır: "1.2" geçerli sayılıyor.
        let patch = match parts.next() {
            Some(p) => p.parse().ok()?,
            None => 0,
        };
        // Dördüncü bir parça varsa bu bizim tanıdığımız biçim değil.
        if parts.next().is_some() {
            return None;
        }

        Some(Self {
            major,
            minor,
            patch,
        })
    }

    /// Bu sürüm `other`'dan yeni mi.
    pub fn is_newer_than(self, other: Self) -> bool {
        self.cmp_version(other) == Ordering::Greater
    }

    fn cmp_version(self, other: Self) -> Ordering {
        (self.major, self.minor, self.patch).cmp(&(other.major, other.minor, other.patch))
    }
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// Uygulamanın derlendiği sürüm.
///
/// `Cargo.toml`'dan geliyor, elle yazılmıyor: elle yazılan bir sabit, sürüm
/// betiği üç dosyayı güncelledikten sonra dördüncü olarak geride kalırdı.
pub const CURRENT: &str = env!("CARGO_PKG_VERSION");

/// Bir güncelleme kontrolünün sonucu.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateCheck {
    /// En güncel sürüm çalışıyor.
    UpToDate { current: String },
    /// Daha yeni bir sürüm var.
    Available {
        current: String,
        latest: String,
        /// Kullanıcının indireceği sayfa.
        url: String,
        /// Yayın notları — boş olabilir.
        notes: String,
    },
    /// Kontrol edilemedi (ağ yok, servis yanıt vermedi).
    ///
    /// Hata **saklanmıyor**: sessizce "güncel" demek, kullanıcıyı eski
    /// sürümde tutup güncel olduğuna inandırırdı.
    Failed { current: String, error: String },
}

/// Yayın bilgisinden karar üretir.
///
/// `latest_tag` ayrıştırılamazsa güncelleme **önerilmiyor**: tanımadığımız
/// bir etikete bakıp "yeni sürüm var" demek, kullanıcıyı olmayan bir şeyi
/// indirmeye gönderirdi.
pub fn decide(current: &str, latest_tag: &str, url: &str, notes: &str) -> UpdateCheck {
    let Some(current_v) = Version::parse(current) else {
        return UpdateCheck::Failed {
            current: current.to_string(),
            error: "çalışan sürüm okunamadı".to_string(),
        };
    };
    let Some(latest_v) = Version::parse(latest_tag) else {
        return UpdateCheck::Failed {
            current: current_v.to_string(),
            error: format!("yayın etiketi anlaşılamadı: {latest_tag}"),
        };
    };

    if latest_v.is_newer_than(current_v) {
        UpdateCheck::Available {
            current: current_v.to_string(),
            latest: latest_v.to_string(),
            url: url.to_string(),
            notes: notes.to_string(),
        }
    } else {
        // Yerelde daha yeni bir sürüm de olabilir (geliştirme derlemesi);
        // o da "güncel" sayılıyor, geri sürüm önerilmiyor.
        UpdateCheck::UpToDate {
            current: current_v.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_version_parses() {
        let v = Version::parse("0.7.4").unwrap();
        assert_eq!((v.major, v.minor, v.patch), (0, 7, 4));
    }

    #[test]
    fn a_tag_prefix_is_accepted() {
        // Yayın etiketleri "v" ile geliyor, dosyadaki sürümler gelmiyor.
        assert_eq!(Version::parse("v1.2.3"), Version::parse("1.2.3"));
    }

    #[test]
    fn a_prerelease_suffix_is_ignored_not_rejected() {
        let v = Version::parse("1.2.3-beta.1").unwrap();
        assert_eq!(v.to_string(), "1.2.3");
    }

    #[test]
    fn a_missing_patch_number_counts_as_zero() {
        assert_eq!(Version::parse("1.2").unwrap().to_string(), "1.2.0");
    }

    #[test]
    fn nonsense_is_refused() {
        assert!(Version::parse("").is_none());
        assert!(Version::parse("sürüm yok").is_none());
        assert!(Version::parse("1.2.3.4").is_none());
        assert!(Version::parse("a.b.c").is_none());
    }

    /// Bu testin varlık sebebi: metin karşılaştırmasında `"0.10.0" < "0.9.0"`,
    /// çünkü `'1' < '9'`. Sürümler sayı olarak karşılaştırılmalı.
    #[test]
    fn ten_is_newer_than_nine() {
        let ten = Version::parse("0.10.0").unwrap();
        let nine = Version::parse("0.9.0").unwrap();
        assert!(ten.is_newer_than(nine));
        assert!(!nine.is_newer_than(ten));
        // Metin karşılaştırması tersini söylerdi — kanıt:
        assert!("0.10.0" < "0.9.0");
    }

    #[test]
    fn the_same_version_is_not_newer() {
        let v = Version::parse("1.0.0").unwrap();
        assert!(!v.is_newer_than(v));
    }

    #[test]
    fn each_field_outranks_the_ones_after_it() {
        let a = Version::parse("2.0.0").unwrap();
        let b = Version::parse("1.99.99").unwrap();
        assert!(a.is_newer_than(b));

        let c = Version::parse("1.2.0").unwrap();
        let d = Version::parse("1.1.99").unwrap();
        assert!(c.is_newer_than(d));
    }

    #[test]
    fn a_newer_release_is_offered() {
        let out = decide("0.7.4", "v0.8.0", "https://example.invalid/r", "notlar");
        match out {
            UpdateCheck::Available { latest, url, .. } => {
                assert_eq!(latest, "0.8.0");
                assert!(url.contains("example.invalid"));
            }
            other => panic!("güncelleme beklenirdi: {other:?}"),
        }
    }

    #[test]
    fn the_same_release_is_up_to_date() {
        assert!(matches!(
            decide("0.7.4", "v0.7.4", "", ""),
            UpdateCheck::UpToDate { .. }
        ));
    }

    /// Yerelde daha yeni bir derleme varsa geri sürüm önerilmemeli.
    #[test]
    fn an_older_release_is_never_offered_as_an_update() {
        assert!(matches!(
            decide("0.9.0", "v0.7.4", "", ""),
            UpdateCheck::UpToDate { .. }
        ));
    }

    /// Anlaşılmayan etiket "güncel" sayılmamalı: kullanıcıyı olmayan bir
    /// sürüme göndermek de, sessizce eski bırakmak da yanlış.
    #[test]
    fn an_unreadable_tag_reports_a_failure_rather_than_pretending() {
        assert!(matches!(
            decide("0.7.4", "en son sürüm", "", ""),
            UpdateCheck::Failed { .. }
        ));
    }

    #[test]
    fn the_compiled_version_is_readable() {
        // Sürüm betiği `Cargo.toml`'u bozarsa burada yakalanır.
        assert!(Version::parse(CURRENT).is_some(), "CURRENT: {CURRENT}");
    }
}
