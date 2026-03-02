use rusqlite::Connection;
use std::time::{SystemTime, UNIX_EPOCH};

/// Maximum number of pairing attempts before the code is invalidated.
const MAX_PAIRING_ATTEMPTS: i32 = 5;

/// Pairing code validity window in milliseconds (5 minutes).
#[allow(dead_code)]
const PAIRING_CODE_EXPIRY_MS: i64 = 5 * 60 * 1000;

/// Maximum number of concurrent active sessions.
const MAX_ACTIVE_SESSIONS: usize = 3;

/// Default WebSocket server port.
const DEFAULT_PORT: u16 = 9347;

// ---------------------------------------------------------------------------
// Table bootstrap
// ---------------------------------------------------------------------------

/// Creates the `remote_access_settings` and `remote_sessions` tables if they
/// do not already exist. Call this once when the database connection is opened.
pub fn bootstrap_auth_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS remote_access_settings (
            id                    INTEGER PRIMARY KEY CHECK (id = 1),
            enabled               INTEGER NOT NULL DEFAULT 0,
            port                  INTEGER NOT NULL DEFAULT 9347,
            master_token_hash     TEXT,
            pairing_code          TEXT,
            pairing_code_expires_ms INTEGER,
            pairing_attempts      INTEGER NOT NULL DEFAULT 0,
            created_at_ms         INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS remote_sessions (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            device_name        TEXT NOT NULL,
            session_token_hash TEXT NOT NULL UNIQUE,
            paired_at_ms       INTEGER NOT NULL,
            last_seen_ms       INTEGER NOT NULL,
            revoked            INTEGER NOT NULL DEFAULT 0
        );
        ",
    )
    .map_err(|e| format!("Failed to bootstrap auth tables: {e}"))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

/// Returns `true` if remote access is enabled in the settings table.
/// Defaults to `false` when no row exists.
pub fn is_remote_access_enabled(conn: &Connection) -> bool {
    conn.query_row(
        "SELECT enabled FROM remote_access_settings WHERE id = 1",
        [],
        |row| row.get::<_, i32>(0),
    )
    .map(|v| v != 0)
    .unwrap_or(false)
}

/// Returns the configured WebSocket port, falling back to the default (9347).
pub fn get_remote_access_port(conn: &Connection) -> u16 {
    conn.query_row(
        "SELECT port FROM remote_access_settings WHERE id = 1",
        [],
        |row| row.get::<_, i32>(0),
    )
    .map(|v| v as u16)
    .unwrap_or(DEFAULT_PORT)
}

// ---------------------------------------------------------------------------
// Pairing code validation
// ---------------------------------------------------------------------------

/// Validates a 6-digit pairing code against the stored value.
///
/// Enforces anti-bruteforce limits:
/// - Maximum [`MAX_PAIRING_ATTEMPTS`] attempts per code.
/// - Code must not have expired (see [`PAIRING_CODE_EXPIRY_MS`]).
///
/// On successful validation the attempt counter is reset to zero so that a
/// fresh code can be issued later.
pub fn validate_pairing_code(conn: &Connection, code: &str) -> Result<bool, String> {
    let now_ms = now_millis();

    // Fetch the stored pairing code, expiry, and attempt count.
    let row: Result<(Option<String>, Option<i64>, i32), _> = conn.query_row(
        "SELECT pairing_code, pairing_code_expires_ms, pairing_attempts \
         FROM remote_access_settings WHERE id = 1",
        [],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, i32>(2)?,
            ))
        },
    );

    let (stored_code, expires_ms, attempts) = match row {
        Ok(r) => r,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err("Remote access not configured".into());
        }
        Err(e) => return Err(format!("DB error reading pairing code: {e}")),
    };

    // Check attempt limit.
    if attempts >= MAX_PAIRING_ATTEMPTS {
        return Err("Pairing code locked: too many attempts".into());
    }

    // Increment attempt counter regardless of outcome.
    conn.execute(
        "UPDATE remote_access_settings SET pairing_attempts = pairing_attempts + 1 WHERE id = 1",
        [],
    )
    .map_err(|e| format!("DB error incrementing attempts: {e}"))?;

    // Check expiry.
    if let Some(exp) = expires_ms {
        if now_ms > exp {
            return Err("Pairing code has expired".into());
        }
    } else {
        return Err("No pairing code expiry set".into());
    }

    // Compare codes (constant-ish time for short strings, but the real
    // protection is the attempt limit).
    let valid = match stored_code {
        Some(ref sc) => constant_time_eq(sc.as_bytes(), code.as_bytes()),
        None => false,
    };

    if valid {
        // Reset attempts on success so a new code can be issued.
        conn.execute(
            "UPDATE remote_access_settings SET pairing_attempts = 0 WHERE id = 1",
            [],
        )
        .map_err(|e| format!("DB error resetting attempts: {e}"))?;
    }

    Ok(valid)
}

// ---------------------------------------------------------------------------
// Session token validation
// ---------------------------------------------------------------------------

/// Validates a session token hash against active (non-revoked) sessions.
///
/// On success, updates `last_seen_ms` for the matching session.
pub fn validate_session_token(conn: &Connection, token_hash: &str) -> Result<bool, String> {
    let now_ms = now_millis();

    let result = conn.query_row(
        "SELECT id FROM remote_sessions WHERE session_token_hash = ?1 AND revoked = 0",
        [token_hash],
        |row| row.get::<_, i64>(0),
    );

    match result {
        Ok(session_id) => {
            conn.execute(
                "UPDATE remote_sessions SET last_seen_ms = ?1 WHERE id = ?2",
                rusqlite::params![now_ms, session_id],
            )
            .map_err(|e| format!("DB error updating last_seen: {e}"))?;
            Ok(true)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(format!("DB error validating session token: {e}")),
    }
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

/// Creates a new remote session. If the number of active sessions would exceed
/// [`MAX_ACTIVE_SESSIONS`], the oldest session (by `last_seen_ms`) is revoked
/// to make room.
///
/// Returns the new session's row id.
pub fn create_session(
    conn: &Connection,
    device_name: &str,
    session_token_hash: &str,
) -> Result<i64, String> {
    let now_ms = now_millis();

    // Count active sessions.
    let active_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM remote_sessions WHERE revoked = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("DB error counting sessions: {e}"))?;

    // Evict oldest if at capacity.
    if active_count as usize >= MAX_ACTIVE_SESSIONS {
        conn.execute(
            "UPDATE remote_sessions SET revoked = 1 \
             WHERE id = (SELECT id FROM remote_sessions WHERE revoked = 0 ORDER BY last_seen_ms ASC LIMIT 1)",
            [],
        )
        .map_err(|e| format!("DB error revoking oldest session: {e}"))?;
    }

    conn.execute(
        "INSERT INTO remote_sessions (device_name, session_token_hash, paired_at_ms, last_seen_ms, revoked) \
         VALUES (?1, ?2, ?3, ?4, 0)",
        rusqlite::params![device_name, session_token_hash, now_ms, now_ms],
    )
    .map_err(|e| format!("DB error creating session: {e}"))?;

    Ok(conn.last_insert_rowid())
}

// ---------------------------------------------------------------------------
// Pairing code generation
// ---------------------------------------------------------------------------

#[allow(dead_code)]
/// Generates a 6-digit numeric pairing code derived from the master token hash
/// and the current timestamp. The derivation is intentionally simple for Phase 1;
/// a proper HMAC-based derivation will be added later.
pub fn generate_pairing_code(master_token_hash: &str) -> String {
    let now = now_millis();
    // Simple derivation: sum bytes of the hash, mix with timestamp.
    let hash_sum: u64 = master_token_hash.bytes().map(|b| b as u64).sum();
    let mixed = hash_sum.wrapping_mul(31).wrapping_add(now as u64);
    let code = (mixed % 1_000_000) as u32;
    format!("{:06}", code)
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/// Returns the current time in milliseconds since the UNIX epoch.
fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Constant-time-ish comparison for byte slices. Not truly constant-time at the
/// CPU level (we are not using inline assembly), but prevents short-circuit
/// early returns which is the main concern for a local pairing code.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        bootstrap_auth_tables(&conn).unwrap();
        conn
    }

    #[test]
    fn test_defaults_when_no_row() {
        let conn = setup_db();
        assert!(!is_remote_access_enabled(&conn));
        assert_eq!(get_remote_access_port(&conn), DEFAULT_PORT);
    }

    #[test]
    fn test_generate_pairing_code_is_6_digits() {
        let code = generate_pairing_code("somehash");
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_constant_time_eq() {
        assert!(constant_time_eq(b"hello", b"hello"));
        assert!(!constant_time_eq(b"hello", b"world"));
        assert!(!constant_time_eq(b"short", b"longer"));
    }

    // ── Session lifecycle tests ──────────────────────────────────────────

    fn insert_settings(conn: &Connection, enabled: bool, code: &str, expires_ms: i64) {
        conn.execute(
            "INSERT OR REPLACE INTO remote_access_settings \
             (id, enabled, port, master_token_hash, pairing_code, pairing_code_expires_ms, pairing_attempts, created_at_ms) \
             VALUES (1, ?1, 9347, 'hash', ?2, ?3, 0, ?4)",
            rusqlite::params![enabled as i32, code, expires_ms, now_millis()],
        )
        .unwrap();
    }

    #[test]
    fn test_remote_access_enabled_flag() {
        let conn = setup_db();
        insert_settings(&conn, true, "123456", now_millis() + 300_000);
        assert!(is_remote_access_enabled(&conn));

        conn.execute(
            "UPDATE remote_access_settings SET enabled = 0 WHERE id = 1",
            [],
        )
        .unwrap();
        assert!(!is_remote_access_enabled(&conn));
    }

    #[test]
    fn test_create_and_validate_session() {
        let conn = setup_db();
        let session_id = create_session(&conn, "Test iPad", "token-hash-abc").unwrap();
        assert!(session_id > 0);

        assert!(validate_session_token(&conn, "token-hash-abc").unwrap());
        assert!(!validate_session_token(&conn, "wrong-token").unwrap());
    }

    #[test]
    fn test_revoked_session_is_invalid() {
        let conn = setup_db();
        let session_id = create_session(&conn, "Test iPad", "token-hash-abc").unwrap();

        conn.execute(
            "UPDATE remote_sessions SET revoked = 1 WHERE id = ?1",
            [session_id],
        )
        .unwrap();

        assert!(!validate_session_token(&conn, "token-hash-abc").unwrap());
    }

    #[test]
    fn test_max_sessions_evicts_oldest() {
        let conn = setup_db();

        // Create 3 sessions (at capacity)
        create_session(&conn, "Device 1", "token-1").unwrap();
        create_session(&conn, "Device 2", "token-2").unwrap();
        create_session(&conn, "Device 3", "token-3").unwrap();

        // Creating a 4th should evict the oldest (Device 1)
        create_session(&conn, "Device 4", "token-4").unwrap();

        // token-1 should be revoked
        assert!(!validate_session_token(&conn, "token-1").unwrap());
        // Others should still be valid
        assert!(validate_session_token(&conn, "token-2").unwrap());
        assert!(validate_session_token(&conn, "token-3").unwrap());
        assert!(validate_session_token(&conn, "token-4").unwrap());
    }

    // ── Pairing code tests ──────────────────────────────────────────────

    #[test]
    fn test_valid_pairing_code() {
        let conn = setup_db();
        let expires = now_millis() + 300_000; // 5 min from now
        insert_settings(&conn, true, "654321", expires);

        assert!(validate_pairing_code(&conn, "654321").unwrap());
    }

    #[test]
    fn test_invalid_pairing_code() {
        let conn = setup_db();
        let expires = now_millis() + 300_000;
        insert_settings(&conn, true, "654321", expires);

        assert!(!validate_pairing_code(&conn, "000000").unwrap());
    }

    #[test]
    fn test_expired_pairing_code() {
        let conn = setup_db();
        let expires = now_millis() - 1000; // Already expired
        insert_settings(&conn, true, "654321", expires);

        let result = validate_pairing_code(&conn, "654321");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("expired"));
    }

    #[test]
    fn test_pairing_code_attempt_limit() {
        let conn = setup_db();
        let expires = now_millis() + 300_000;
        insert_settings(&conn, true, "654321", expires);

        // Exhaust attempts with wrong codes
        for _ in 0..MAX_PAIRING_ATTEMPTS {
            let _ = validate_pairing_code(&conn, "000000");
        }

        // Now even the correct code should fail
        let result = validate_pairing_code(&conn, "654321");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too many attempts"));
    }

    #[test]
    fn test_successful_pairing_resets_attempts() {
        let conn = setup_db();
        let expires = now_millis() + 300_000;
        insert_settings(&conn, true, "654321", expires);

        // Use some attempts with wrong code
        let _ = validate_pairing_code(&conn, "000000");
        let _ = validate_pairing_code(&conn, "000000");

        // Correct code should reset attempts
        assert!(validate_pairing_code(&conn, "654321").unwrap());

        // Verify counter was reset
        let attempts: i32 = conn
            .query_row(
                "SELECT pairing_attempts FROM remote_access_settings WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(attempts, 0);
    }
}
