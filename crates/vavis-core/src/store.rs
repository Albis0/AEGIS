//! SQLite depolama.
//!
//! F1'de sadece şema + sürümleme var; sohbet kaydı F2'de kullanılacak.
//! Sürümleme baştan konuldu çünkü sonradan eklemek acı verir: `schema_version`
//! tablosu ile her açılışta eksik göçler uygulanır.

use crate::error::Result;
use crate::paths::Paths;
use rusqlite::Connection;

/// Kodun beklediği şema sürümü. Yeni göç eklendikçe artar.
pub const SCHEMA_VERSION: i64 = 1;

pub struct Store {
    conn: Connection,
}

impl Store {
    pub fn open(paths: &Paths) -> Result<Self> {
        paths.ensure()?;
        let conn = Connection::open(paths.database_file())?;
        Self::init(conn)
    }

    /// Testler için: diskle uğraşmadan bellek içi veritabanı.
    pub fn open_in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> Result<Self> {
        // WAL: yazma sırasında okuma bloklanmaz. Ses/UI aynı anda okuyacağı için önemli.
        // (in-memory veritabanı WAL desteklemez — hata yutulur, testte sorun değil.)
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        conn.pragma_update(None, "foreign_keys", "ON")?;

        let mut store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&mut self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);",
        )?;

        let current: Option<i64> = self
            .conn
            .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
            .ok();

        match current {
            Some(v) if v >= SCHEMA_VERSION => return Ok(()),
            Some(v) => tracing::info!(from = v, to = SCHEMA_VERSION, "şema yükseltiliyor"),
            None => tracing::info!(version = SCHEMA_VERSION, "şema oluşturuluyor"),
        }

        // v1 — sohbet kaydı (F2'de doldurulacak).
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS messages (
                 id         INTEGER PRIMARY KEY AUTOINCREMENT,
                 role       TEXT    NOT NULL,
                 content    TEXT    NOT NULL,
                 created_at INTEGER NOT NULL DEFAULT (unixepoch())
             );
             CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);",
        )?;

        self.conn.execute("DELETE FROM schema_version", [])?;
        self.conn
            .execute("INSERT INTO schema_version (version) VALUES (?1)", [SCHEMA_VERSION])?;
        Ok(())
    }

    pub fn schema_version(&self) -> Result<i64> {
        Ok(self
            .conn
            .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))?)
    }

    /// Sağlık ekranı için mesaj sayısı.
    pub fn message_count(&self) -> Result<i64> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM messages", [], |r| r.get(0))?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_db_is_at_current_version() {
        let store = Store::open_in_memory().unwrap();
        assert_eq!(store.schema_version().unwrap(), SCHEMA_VERSION);
        assert_eq!(store.message_count().unwrap(), 0);
    }

    #[test]
    fn reopening_existing_db_does_not_lose_data() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::with_root(tmp.path());

        {
            let store = Store::open(&paths).unwrap();
            store
                .conn
                .execute("INSERT INTO messages (role, content) VALUES ('user', 'selam')", [])
                .unwrap();
        }

        let store = Store::open(&paths).unwrap(); // ikinci açılış = göç tekrar çalışır
        assert_eq!(store.message_count().unwrap(), 1);
        assert_eq!(store.schema_version().unwrap(), SCHEMA_VERSION);
    }
}
