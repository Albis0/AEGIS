//! The generated-media index.
//!
//! Files live on disk under [`Paths::media_dir`]; this table holds only the
//! path and the parameters that produced them. That split is deliberate: a
//! gallery of a few hundred images is a few hundred megabytes, and putting
//! that in SQLite would slow down every unrelated read.
//!
//! Parameters are stored because a result you like is worthless if you cannot
//! make it again. Seed, model, size and prompt all come back with the item, so
//! "same again, but…" is one click rather than a guess.

use crate::error::Result;
use crate::store::Store;
use rusqlite::OptionalExtension;

/// What a gallery item is. Stored as text so the column reads plainly in a
/// SQLite browser and survives new kinds without a migration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Image,
    Video,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Image => "image",
            Self::Video => "video",
        }
    }

    pub fn parse(text: &str) -> Self {
        match text {
            "video" => Self::Video,
            _ => Self::Image,
        }
    }
}

/// One generated file.
#[derive(Debug, Clone, PartialEq)]
pub struct Item {
    pub id: i64,
    pub kind: Kind,
    /// Relative to [`Paths::media_dir`], so moving the data directory does not
    /// break the gallery.
    pub path: String,
    pub prompt: String,
    pub provider: String,
    pub model: String,
    /// Everything needed to reproduce this: size, steps, duration, and so on.
    /// JSON because the set differs per provider and per kind.
    pub params: String,
    /// `None` when the provider does not report one — which means this item
    /// cannot be reproduced exactly, and the interface says so.
    pub seed: Option<i64>,
    pub width: i64,
    pub height: i64,
    pub bytes: i64,
    /// The item this was derived from, for variations and upscales.
    pub parent_id: Option<i64>,
    pub favourite: bool,
    pub created_at: i64,
}

/// What a new row needs. Separate from [`Item`] because the id and timestamp
/// are the database's to assign.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct NewItem {
    pub kind: Option<Kind>,
    pub path: String,
    pub prompt: String,
    pub provider: String,
    pub model: String,
    pub params: String,
    pub seed: Option<i64>,
    pub width: i64,
    pub height: i64,
    pub bytes: i64,
    pub parent_id: Option<i64>,
}

/// How much room the gallery takes, for the "you have 4.2 GB of these" line.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Usage {
    pub items: i64,
    pub bytes: i64,
}

impl Store {
    pub(crate) fn migrate_gallery(&self) -> Result<()> {
        self.connection().execute_batch(
            "CREATE TABLE IF NOT EXISTS gallery (
                 id         INTEGER PRIMARY KEY AUTOINCREMENT,
                 kind       TEXT    NOT NULL DEFAULT 'image',
                 path       TEXT    NOT NULL UNIQUE,
                 prompt     TEXT    NOT NULL DEFAULT '',
                 provider   TEXT    NOT NULL DEFAULT '',
                 model      TEXT    NOT NULL DEFAULT '',
                 params     TEXT    NOT NULL DEFAULT '{}',
                 seed       INTEGER,
                 width      INTEGER NOT NULL DEFAULT 0,
                 height     INTEGER NOT NULL DEFAULT 0,
                 bytes      INTEGER NOT NULL DEFAULT 0,
                 parent_id  INTEGER REFERENCES gallery(id) ON DELETE SET NULL,
                 favourite  INTEGER NOT NULL DEFAULT 0,
                 created_at INTEGER NOT NULL DEFAULT (unixepoch())
             );
             CREATE INDEX IF NOT EXISTS idx_gallery_created ON gallery(created_at);",
        )?;
        Ok(())
    }

    pub fn add_gallery_item(&self, item: &NewItem) -> Result<i64> {
        self.connection().execute(
            "INSERT INTO gallery
                 (kind, path, prompt, provider, model, params,
                  seed, width, height, bytes, parent_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                item.kind.unwrap_or(Kind::Image).as_str(),
                item.path,
                item.prompt,
                item.provider,
                item.model,
                item.params,
                item.seed,
                item.width,
                item.height,
                item.bytes,
                item.parent_id,
            ],
        )?;
        Ok(self.connection().last_insert_rowid())
    }

    /// Newest first — the grid shows what was just made at the top.
    pub fn gallery_items(&self, limit: usize) -> Result<Vec<Item>> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, kind, path, prompt, provider, model, params, seed,
                    width, height, bytes, parent_id, favourite, created_at
             FROM gallery ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit as i64], row_to_item)?;
        Ok(rows.filter_map(std::result::Result::ok).collect())
    }

    pub fn gallery_item(&self, id: i64) -> Result<Option<Item>> {
        let conn = self.connection();
        Ok(conn
            .query_row(
                "SELECT id, kind, path, prompt, provider, model, params, seed,
                        width, height, bytes, parent_id, favourite, created_at
                 FROM gallery WHERE id = ?1",
                [id],
                row_to_item,
            )
            .optional()?)
    }

    /// Removes the row and reports the file it pointed at, so the caller can
    /// delete it. The store never touches the filesystem itself — one owner
    /// per concern.
    pub fn delete_gallery_item(&self, id: i64) -> Result<Option<String>> {
        let path: Option<String> = self
            .connection()
            .query_row("SELECT path FROM gallery WHERE id = ?1", [id], |r| r.get(0))
            .optional()?;
        if path.is_some() {
            self.connection()
                .execute("DELETE FROM gallery WHERE id = ?1", [id])?;
        }
        Ok(path)
    }

    pub fn set_gallery_favourite(&self, id: i64, favourite: bool) -> Result<bool> {
        let n = self.connection().execute(
            "UPDATE gallery SET favourite = ?2 WHERE id = ?1",
            rusqlite::params![id, i64::from(favourite)],
        )?;
        Ok(n > 0)
    }

    /// Every path in the gallery except the favourites, so "clear" can spare
    /// what the user marked. Rows are deleted; the files are the caller's.
    pub fn clear_gallery(&self, keep_favourites: bool) -> Result<Vec<String>> {
        let sql = if keep_favourites {
            "SELECT path FROM gallery WHERE favourite = 0"
        } else {
            "SELECT path FROM gallery"
        };

        let conn = self.connection();
        let paths: Vec<String> = {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
            rows.filter_map(std::result::Result::ok).collect()
        };

        if keep_favourites {
            conn.execute("DELETE FROM gallery WHERE favourite = 0", [])?;
        } else {
            conn.execute("DELETE FROM gallery", [])?;
        }
        Ok(paths)
    }

    pub fn gallery_usage(&self) -> Result<Usage> {
        Ok(self.connection().query_row(
            "SELECT COUNT(*), COALESCE(SUM(bytes), 0) FROM gallery",
            [],
            |r| {
                Ok(Usage {
                    items: r.get(0)?,
                    bytes: r.get(1)?,
                })
            },
        )?)
    }
}

fn row_to_item(r: &rusqlite::Row<'_>) -> rusqlite::Result<Item> {
    Ok(Item {
        id: r.get(0)?,
        kind: Kind::parse(&r.get::<_, String>(1)?),
        path: r.get(2)?,
        prompt: r.get(3)?,
        provider: r.get(4)?,
        model: r.get(5)?,
        params: r.get(6)?,
        seed: r.get(7)?,
        width: r.get(8)?,
        height: r.get(9)?,
        bytes: r.get(10)?,
        parent_id: r.get(11)?,
        favourite: r.get::<_, i64>(12)? != 0,
        created_at: r.get(13)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(path: &str) -> NewItem {
        NewItem {
            kind: Some(Kind::Image),
            path: path.to_string(),
            prompt: "a cat".into(),
            provider: "openai".into(),
            model: "gpt-image-1".into(),
            params: r#"{"size":"1024x1024"}"#.into(),
            seed: Some(42),
            width: 1024,
            height: 1024,
            bytes: 500_000,
            parent_id: None,
        }
    }

    #[test]
    fn round_trips_everything_needed_to_reproduce() {
        let store = Store::open_in_memory().unwrap();
        let id = store.add_gallery_item(&item("a.png")).unwrap();

        let got = store.gallery_item(id).unwrap().unwrap();
        assert_eq!(got.seed, Some(42));
        assert_eq!(got.model, "gpt-image-1");
        assert_eq!(got.params, r#"{"size":"1024x1024"}"#);
        assert_eq!(got.kind, Kind::Image);
        assert!(!got.favourite);
    }

    #[test]
    fn newest_item_is_listed_first() {
        let store = Store::open_in_memory().unwrap();
        store.add_gallery_item(&item("a.png")).unwrap();
        store.add_gallery_item(&item("b.png")).unwrap();

        let listed = store.gallery_items(10).unwrap();
        assert_eq!(listed[0].path, "b.png");
        assert_eq!(listed[1].path, "a.png");
    }

    #[test]
    fn delete_reports_the_file_to_remove() {
        let store = Store::open_in_memory().unwrap();
        let id = store.add_gallery_item(&item("a.png")).unwrap();

        assert_eq!(
            store.delete_gallery_item(id).unwrap().as_deref(),
            Some("a.png")
        );
        assert!(store.gallery_item(id).unwrap().is_none());
        // A second delete is not an error, it just has no file to report.
        assert_eq!(store.delete_gallery_item(id).unwrap(), None);
    }

    #[test]
    fn clear_can_spare_favourites() {
        let store = Store::open_in_memory().unwrap();
        let keep = store.add_gallery_item(&item("keep.png")).unwrap();
        store.add_gallery_item(&item("drop.png")).unwrap();
        store.set_gallery_favourite(keep, true).unwrap();

        let removed = store.clear_gallery(true).unwrap();
        assert_eq!(removed, vec!["drop.png"]);

        let left = store.gallery_items(10).unwrap();
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].path, "keep.png");
    }

    #[test]
    fn usage_adds_up_the_bytes() {
        let store = Store::open_in_memory().unwrap();
        store.add_gallery_item(&item("a.png")).unwrap();
        store.add_gallery_item(&item("b.png")).unwrap();

        let usage = store.gallery_usage().unwrap();
        assert_eq!(usage.items, 2);
        assert_eq!(usage.bytes, 1_000_000);
    }

    #[test]
    fn deleting_a_parent_leaves_its_variations() {
        let store = Store::open_in_memory().unwrap();
        let parent = store.add_gallery_item(&item("parent.png")).unwrap();

        let mut child = item("child.png");
        child.parent_id = Some(parent);
        let child_id = store.add_gallery_item(&child).unwrap();

        store.delete_gallery_item(parent).unwrap();

        // ON DELETE SET NULL: losing the original must not take the
        // variations with it.
        let got = store.gallery_item(child_id).unwrap().unwrap();
        assert_eq!(got.parent_id, None);
    }

    /// A user upgrading from 0.3.0 has a v3 database with real data in it.
    #[test]
    fn a_v3_database_gains_the_gallery_without_losing_anything() {
        use crate::paths::Paths;
        use rusqlite::Connection;

        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::with_root(tmp.path());
        paths.ensure().unwrap();

        {
            let conn = Connection::open(paths.database_file()).unwrap();
            conn.execute_batch(
                "CREATE TABLE schema_version (version INTEGER NOT NULL);
                 INSERT INTO schema_version VALUES (3);
                 CREATE TABLE messages (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     role TEXT NOT NULL,
                     content TEXT NOT NULL,
                     created_at INTEGER NOT NULL DEFAULT (unixepoch()));
                 INSERT INTO messages (role, content) VALUES ('user', 'older message');",
            )
            .unwrap();
        }

        let store = Store::open(&paths).unwrap();

        assert_eq!(store.message_count().unwrap(), 1, "old data must survive");
        store.add_gallery_item(&item("a.png")).unwrap();
        assert_eq!(store.gallery_usage().unwrap().items, 1);
    }

    #[test]
    fn the_same_file_cannot_be_indexed_twice() {
        let store = Store::open_in_memory().unwrap();
        store.add_gallery_item(&item("a.png")).unwrap();
        assert!(store.add_gallery_item(&item("a.png")).is_err());
    }
}
