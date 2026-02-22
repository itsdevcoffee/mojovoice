use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use std::path::Path;

#[derive(Debug, Clone)]
pub struct VocabEntry {
    #[allow(dead_code)]
    pub id: i64,
    pub term: String,
    #[allow(dead_code)]
    pub added_at: i64,
    pub use_count: i64,
    pub source: String,
}

pub struct VocabStore {
    conn: Connection,
}

impl VocabStore {
    /// Open the vocabulary database at the default location (~/.local/share/mojovoice/vocab.db).
    pub fn open() -> Result<Self> {
        let db_path = crate::state::paths::get_data_dir()
            .context("Failed to get data directory")?
            .join("vocab.db");
        Self::open_with_path(&db_path)
    }

    /// Open the vocabulary database at an explicit path (used in tests).
    pub fn open_with_path(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)
            .with_context(|| format!("Failed to open vocab DB at {}", path.display()))?;
        let store = VocabStore { conn };
        store.create_schema()?;
        Ok(store)
    }

    fn create_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS vocabulary (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                term     TEXT    NOT NULL UNIQUE,
                added_at INTEGER NOT NULL,
                use_count INTEGER NOT NULL DEFAULT 0,
                source   TEXT    NOT NULL
            );",
        )?;
        Ok(())
    }

    /// Add a term to the vocabulary. Duplicate terms are silently ignored.
    pub fn add_term(&self, term: &str, source: &str) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        self.conn
            .execute(
                "INSERT OR IGNORE INTO vocabulary (term, added_at, use_count, source)
                 VALUES (?1, ?2, 0, ?3)",
                params![term, now, source],
            )
            .context("Failed to add term")?;
        Ok(())
    }

    /// Remove a term from the vocabulary. Returns true if deleted, false if not found.
    pub fn remove_term(&self, term: &str) -> Result<bool> {
        let rows_affected = self.conn
            .execute("DELETE FROM vocabulary WHERE term = ?1", params![term])
            .context("Failed to remove term")?;
        Ok(rows_affected > 0)
    }

    /// Return all vocabulary entries sorted by use_count DESC, then term ASC.
    pub fn list_terms(&self) -> Result<Vec<VocabEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, term, added_at, use_count, source
             FROM vocabulary
             ORDER BY use_count DESC, term ASC",
        )?;

        let entries = stmt
            .query_map([], |row| {
                Ok(VocabEntry {
                    id: row.get(0)?,
                    term: row.get(1)?,
                    added_at: row.get(2)?,
                    use_count: row.get(3)?,
                    source: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()
            .context("Failed to list terms")?;

        Ok(entries)
    }

    /// Increment the use_count for the given term. No-op if the term doesn't exist.
    #[allow(dead_code)]
    pub fn increment_use_count(&self, term: &str) -> Result<()> {
        self.conn
            .execute(
                "UPDATE vocabulary SET use_count = use_count + 1 WHERE term = ?1",
                params![term],
            )
            .context("Failed to increment use count")?;
        Ok(())
    }

    /// Return a comma-separated prompt string of terms (sorted by use_count DESC)
    /// that fits within the given Whisper token budget (1 token ≈ 4 characters).
    /// Returns None if the vocabulary is empty.
    pub fn get_prompt_string(&self, max_tokens: usize) -> Result<Option<String>> {
        let entries = self.list_terms()?;
        if entries.is_empty() {
            return Ok(None);
        }

        let char_budget = max_tokens * 4;
        let mut result = String::new();

        for entry in &entries {
            let candidate = if result.is_empty() {
                entry.term.clone()
            } else {
                format!(", {}", entry.term)
            };

            if result.len() + candidate.len() > char_budget {
                break;
            }

            result.push_str(&candidate);
        }

        if result.is_empty() {
            Ok(None)
        } else {
            Ok(Some(result))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn temp_store() -> (VocabStore, TempDir) {
        let dir = TempDir::new().expect("temp dir");
        let store = VocabStore::open_with_path(&dir.path().join("test_vocab.db"))
            .expect("open store");
        (store, dir)
    }

    #[test]
    fn test_add_term_and_duplicate_is_noop() {
        let (store, _dir) = temp_store();

        store.add_term("Claude", "manual").unwrap();
        store.add_term("Claude", "manual").unwrap(); // duplicate - no-op

        let terms = store.list_terms().unwrap();
        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].term, "Claude");
    }

    #[test]
    fn test_remove_term() {
        let (store, _dir) = temp_store();

        store.add_term("Claude", "manual").unwrap();
        store.add_term("Maximus", "manual").unwrap();
        let deleted = store.remove_term("Claude").unwrap();
        assert!(deleted);

        let terms = store.list_terms().unwrap();
        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].term, "Maximus");
    }

    #[test]
    fn test_remove_term_not_found_returns_false() {
        let (store, _dir) = temp_store();

        let deleted = store.remove_term("NonExistentTerm").unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_list_terms_sorted() {
        let (store, _dir) = temp_store();

        store.add_term("Wolfie", "manual").unwrap();
        store.add_term("Claude", "manual").unwrap();
        store.add_term("Maximus", "manual").unwrap();

        // Claude highest count, Maximus second
        store.increment_use_count("Claude").unwrap();
        store.increment_use_count("Claude").unwrap();
        store.increment_use_count("Maximus").unwrap();

        let terms = store.list_terms().unwrap();
        assert_eq!(terms[0].term, "Claude");   // use_count = 2
        assert_eq!(terms[1].term, "Maximus"); // use_count = 1
        assert_eq!(terms[2].term, "Wolfie");  // use_count = 0
    }

    #[test]
    fn test_get_prompt_string_with_terms() {
        let (store, _dir) = temp_store();

        store.add_term("Wolfie", "manual").unwrap();
        store.add_term("Claude", "manual").unwrap();
        store.add_term("Maximus", "manual").unwrap();

        store.increment_use_count("Claude").unwrap();
        store.increment_use_count("Claude").unwrap();
        store.increment_use_count("Maximus").unwrap();

        let prompt = store.get_prompt_string(224).unwrap();
        assert_eq!(prompt, Some("Claude, Maximus, Wolfie".to_string()));
    }

    #[test]
    fn test_get_prompt_string_empty_returns_none() {
        let (store, _dir) = temp_store();
        let prompt = store.get_prompt_string(224).unwrap();
        assert_eq!(prompt, None);
    }
}
