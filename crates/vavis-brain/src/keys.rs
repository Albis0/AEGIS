//! API anahtarı saklama.
//!
//! Anahtarlar **ayar dosyasında düz metin durmaz** — ayrı bir dosyada, Windows
//! DPAPI ile kullanıcı hesabına bağlı şifrelenmiş olarak tutulur. Dosya başka
//! bir makineye/kullanıcıya kopyalanırsa çözülemez.
//!
//! Windows dışında (geliştirme/test) düz JSON'a düşer — o platformlarda üretim
//! hedefimiz yok, ama kod derlenebilir kalsın diye.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct KeyStore {
    #[serde(flatten)]
    keys: BTreeMap<String, String>,
}

impl KeyStore {
    pub fn get(&self, provider: &str) -> Option<&str> {
        self.keys
            .get(provider)
            .map(String::as_str)
            .filter(|k| !k.trim().is_empty())
    }

    pub fn set(&mut self, provider: impl Into<String>, key: impl Into<String>) {
        let key = key.into();
        let provider = provider.into();
        if key.trim().is_empty() {
            self.keys.remove(&provider);
        } else {
            self.keys.insert(provider, key);
        }
    }

    pub fn remove(&mut self, provider: &str) {
        self.keys.remove(provider);
    }

    /// Anahtarı olan sağlayıcılar.
    pub fn configured(&self) -> Vec<&str> {
        self.keys.keys().map(String::as_str).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.keys.is_empty()
    }

    pub fn path(root: &Path) -> PathBuf {
        root.join("keys.dat")
    }

    pub fn load(root: &Path) -> Self {
        let path = Self::path(root);
        let Ok(raw) = std::fs::read(&path) else {
            return Self::default();
        };
        let Some(plain) = crypto::decrypt(&raw) else {
            tracing::warn!("anahtar dosyası çözülemedi — yok sayılıyor");
            return Self::default();
        };
        serde_json::from_slice(&plain).unwrap_or_else(|e| {
            tracing::warn!(%e, "anahtar dosyası bozuk — yok sayılıyor");
            Self::default()
        })
    }

    pub fn save(&self, root: &Path) -> std::io::Result<()> {
        let path = Self::path(root);
        let plain = serde_json::to_vec(self).expect("KeyStore serileştirilebilir");
        let sealed = crypto::encrypt(&plain);

        // Atomik yazma — yarım anahtar dosyası felaket olur.
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, sealed)?;
        std::fs::rename(&tmp, &path)
    }
}

#[cfg(windows)]
mod crypto {
    //! Windows DPAPI — anahtar kullanıcı hesabına bağlanır.
    use std::ffi::c_void;

    #[repr(C)]
    struct DataBlob {
        cb_data: u32,
        pb_data: *mut u8,
    }

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            data_in: *const DataBlob,
            description: *const u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;

        fn CryptUnprotectData(
            data_in: *const DataBlob,
            description: *mut *mut u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            data_out: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(mem: *mut c_void) -> *mut c_void;
    }

    /// Makine değil, **kullanıcı** kapsamı (varsayılan davranış).
    const FLAGS: u32 = 0;

    fn blob_to_vec(blob: &DataBlob) -> Vec<u8> {
        // SAFETY: DPAPI dolu bir blob döndürdü; uzunluk kadar okuyup kopyalıyoruz.
        let slice = unsafe { std::slice::from_raw_parts(blob.pb_data, blob.cb_data as usize) };
        let out = slice.to_vec();
        // SAFETY: blob'u DPAPI ayırdı, LocalFree ile serbest bırakılır.
        unsafe { LocalFree(blob.pb_data as *mut c_void) };
        out
    }

    pub fn encrypt(plain: &[u8]) -> Vec<u8> {
        let input = DataBlob {
            cb_data: plain.len() as u32,
            pb_data: plain.as_ptr() as *mut u8,
        };
        let mut output = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };

        // SAFETY: her iki blob da geçerli; çıktı DPAPI tarafından doldurulur.
        let ok = unsafe {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                FLAGS,
                &mut output,
            )
        };

        if ok == 0 {
            tracing::error!("DPAPI şifreleme başarısız — anahtarlar kaydedilmiyor");
            return Vec::new();
        }
        blob_to_vec(&output)
    }

    pub fn decrypt(sealed: &[u8]) -> Option<Vec<u8>> {
        if sealed.is_empty() {
            return None;
        }
        let input = DataBlob {
            cb_data: sealed.len() as u32,
            pb_data: sealed.as_ptr() as *mut u8,
        };
        let mut output = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };

        // SAFETY: giriş geçerli; başarısızlıkta çıktı blob'u dokunulmadan kalır.
        let ok = unsafe {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                FLAGS,
                &mut output,
            )
        };

        if ok == 0 {
            return None;
        }
        Some(blob_to_vec(&output))
    }
}

#[cfg(not(windows))]
mod crypto {
    //! Windows dışı: şifreleme yok (geliştirme kolaylığı).
    pub fn encrypt(plain: &[u8]) -> Vec<u8> {
        plain.to_vec()
    }
    pub fn decrypt(sealed: &[u8]) -> Option<Vec<u8>> {
        Some(sealed.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_and_get_roundtrip() {
        let mut ks = KeyStore::default();
        ks.set("groq", "gsk_test123");
        assert_eq!(ks.get("groq"), Some("gsk_test123"));
        assert_eq!(ks.get("openai"), None);
    }

    #[test]
    fn empty_key_is_treated_as_absent() {
        let mut ks = KeyStore::default();
        ks.set("groq", "   ");
        assert_eq!(ks.get("groq"), None);
        assert!(ks.is_empty(), "boş anahtar saklanmamalı");
    }

    #[test]
    fn save_then_load_preserves_keys() {
        let tmp = tempfile::tempdir().unwrap();
        let mut ks = KeyStore::default();
        ks.set("groq", "gsk_abc");
        ks.set("gemini", "AIza_xyz");
        ks.save(tmp.path()).unwrap();

        let loaded = KeyStore::load(tmp.path());
        assert_eq!(loaded.get("groq"), Some("gsk_abc"));
        assert_eq!(loaded.get("gemini"), Some("AIza_xyz"));
    }

    #[test]
    fn keys_are_not_stored_in_plaintext_on_windows() {
        let tmp = tempfile::tempdir().unwrap();
        let mut ks = KeyStore::default();
        ks.set("groq", "GIZLI_ANAHTAR_12345");
        ks.save(tmp.path()).unwrap();

        let raw = std::fs::read(KeyStore::path(tmp.path())).unwrap();
        if cfg!(windows) {
            let as_text = String::from_utf8_lossy(&raw);
            assert!(
                !as_text.contains("GIZLI_ANAHTAR_12345"),
                "anahtar diske düz metin yazılmış!"
            );
        }
    }

    #[test]
    fn missing_file_yields_empty_store() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(KeyStore::load(tmp.path()).is_empty());
    }

    #[test]
    fn corrupt_file_does_not_panic() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(KeyStore::path(tmp.path()), b"bozuk veri").unwrap();
        assert!(KeyStore::load(tmp.path()).is_empty());
    }

    #[test]
    fn save_leaves_no_temp_file() {
        let tmp = tempfile::tempdir().unwrap();
        KeyStore::default().save(tmp.path()).unwrap();
        assert!(!KeyStore::path(tmp.path()).with_extension("tmp").exists());
    }
}
