package alerts

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

type secretRecord struct {
	TelegramTokenCipher string
	GmailAddress        string
	GmailPasswordCipher string
}

func NewStore(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if _, err := db.Exec(`PRAGMA journal_mode = WAL;`); err != nil {
		db.Close()
		return nil, fmt.Errorf("set sqlite journal mode: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}

	if err := s.ensureDefaultConfig(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) migrate() error {
	const schema = `
CREATE TABLE IF NOT EXISTS alert_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  warning_percent REAL NOT NULL,
  warning_for_sec INTEGER NOT NULL,
  critical_percent REAL NOT NULL,
  critical_for_sec INTEGER NOT NULL,
  recovery_percent REAL NOT NULL,
  recovery_for_sec INTEGER NOT NULL,
  cooldown_sec INTEGER NOT NULL,
  telegram_enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  recipient_emails TEXT NOT NULL DEFAULT '[]',
  telegram_chat_ids TEXT NOT NULL DEFAULT '[]',
  retry_delays_sec TEXT NOT NULL DEFAULT '[1,5,15]',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_secrets (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  telegram_token_cipher TEXT NOT NULL DEFAULT '',
  gmail_address TEXT NOT NULL DEFAULT '',
  gmail_password_cipher TEXT NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  cpu_percent REAL NOT NULL,
  channels_json TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at DESC);

CREATE TABLE IF NOT EXISTS alert_silence (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  muted_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`
	if _, err := s.db.Exec(schema); err != nil {
		return fmt.Errorf("migrate alert tables: %w", err)
	}
	return nil
}

func (s *Store) ensureDefaultConfig() error {
	cfg := DefaultConfig()
	_, err := s.db.Exec(`
INSERT INTO alert_settings (
  id, enabled, warning_percent, warning_for_sec,
  critical_percent, critical_for_sec,
  recovery_percent, recovery_for_sec,
  cooldown_sec, telegram_enabled, email_enabled,
  recipient_emails, telegram_chat_ids, retry_delays_sec
)
VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING
`,
		boolToInt(cfg.Enabled),
		cfg.WarningPercent,
		cfg.WarningForSec,
		cfg.CriticalPercent,
		cfg.CriticalForSec,
		cfg.RecoveryPercent,
		cfg.RecoveryForSec,
		cfg.CooldownSec,
		boolToInt(cfg.TelegramEnabled),
		boolToInt(cfg.EmailEnabled),
		mustJSON(cfg.RecipientEmails),
		mustJSON(cfg.TelegramChatIDs),
		mustJSON(cfg.RetryDelaysSec),
	)
	if err != nil {
		return fmt.Errorf("ensure default alert settings: %w", err)
	}

	_, err = s.db.Exec(`
INSERT INTO alert_secrets(id) VALUES(1)
ON CONFLICT(id) DO NOTHING
`)
	if err != nil {
		return fmt.Errorf("ensure default alert secrets: %w", err)
	}

	_, err = s.db.Exec(`
INSERT INTO alert_silence(id, muted_until) VALUES(1, NULL)
ON CONFLICT(id) DO NOTHING
`)
	if err != nil {
		return fmt.Errorf("ensure default alert silence: %w", err)
	}

	return nil
}

func (s *Store) LoadConfig() (Config, error) {
	cfg := DefaultConfig()
	var recipientJSON, chatJSON, retryJSON string
	var enabled, telegramEnabled, emailEnabled int

	err := s.db.QueryRow(`
SELECT
  enabled,
  warning_percent,
  warning_for_sec,
  critical_percent,
  critical_for_sec,
  recovery_percent,
  recovery_for_sec,
  cooldown_sec,
  telegram_enabled,
  email_enabled,
  recipient_emails,
  telegram_chat_ids,
  retry_delays_sec
FROM alert_settings
WHERE id = 1
`).Scan(
		&enabled,
		&cfg.WarningPercent,
		&cfg.WarningForSec,
		&cfg.CriticalPercent,
		&cfg.CriticalForSec,
		&cfg.RecoveryPercent,
		&cfg.RecoveryForSec,
		&cfg.CooldownSec,
		&telegramEnabled,
		&emailEnabled,
		&recipientJSON,
		&chatJSON,
		&retryJSON,
	)
	if err != nil {
		return cfg, fmt.Errorf("load alert config: %w", err)
	}

	cfg.Enabled = enabled == 1
	cfg.TelegramEnabled = telegramEnabled == 1
	cfg.EmailEnabled = emailEnabled == 1
	cfg.RecipientEmails = decodeStringSlice(recipientJSON)
	cfg.TelegramChatIDs = decodeStringSlice(chatJSON)
	cfg.RetryDelaysSec = decodeIntSlice(retryJSON)
	if len(cfg.RetryDelaysSec) == 0 {
		cfg.RetryDelaysSec = []int{1, 5, 15}
	}

	return cfg, nil
}

func (s *Store) SaveConfig(cfg Config) error {
	_, err := s.db.Exec(`
UPDATE alert_settings
SET
  enabled = ?,
  warning_percent = ?,
  warning_for_sec = ?,
  critical_percent = ?,
  critical_for_sec = ?,
  recovery_percent = ?,
  recovery_for_sec = ?,
  cooldown_sec = ?,
  telegram_enabled = ?,
  email_enabled = ?,
  recipient_emails = ?,
  telegram_chat_ids = ?,
  retry_delays_sec = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1
`,
		boolToInt(cfg.Enabled),
		cfg.WarningPercent,
		cfg.WarningForSec,
		cfg.CriticalPercent,
		cfg.CriticalForSec,
		cfg.RecoveryPercent,
		cfg.RecoveryForSec,
		cfg.CooldownSec,
		boolToInt(cfg.TelegramEnabled),
		boolToInt(cfg.EmailEnabled),
		mustJSON(cfg.RecipientEmails),
		mustJSON(cfg.TelegramChatIDs),
		mustJSON(cfg.RetryDelaysSec),
	)
	if err != nil {
		return fmt.Errorf("save alert config: %w", err)
	}
	return nil
}

func (s *Store) LoadSecretRecord() (secretRecord, error) {
	var rec secretRecord
	err := s.db.QueryRow(`
SELECT telegram_token_cipher, gmail_address, gmail_password_cipher
FROM alert_secrets
WHERE id = 1
`).Scan(&rec.TelegramTokenCipher, &rec.GmailAddress, &rec.GmailPasswordCipher)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return rec, nil
		}
		return rec, fmt.Errorf("load alert secrets: %w", err)
	}
	return rec, nil
}

func (s *Store) SaveSecretRecord(rec secretRecord) error {
	_, err := s.db.Exec(`
UPDATE alert_secrets
SET
  telegram_token_cipher = ?,
  gmail_address = ?,
  gmail_password_cipher = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1
`, rec.TelegramTokenCipher, rec.GmailAddress, rec.GmailPasswordCipher)
	if err != nil {
		return fmt.Errorf("save alert secrets: %w", err)
	}
	return nil
}

func (s *Store) SaveEvent(level Level, message string, cpuPercent float64, channels []ChannelResult, createdAt time.Time) (int64, error) {
	result, err := s.db.Exec(`
INSERT INTO alert_events(level, message, cpu_percent, channels_json, created_at)
VALUES (?, ?, ?, ?, ?)
`, string(level), message, cpuPercent, mustJSON(channels), createdAt.UTC())
	if err != nil {
		return 0, fmt.Errorf("save alert event: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("save alert event last insert id: %w", err)
	}
	return id, nil
}

func (s *Store) ListEvents(limit int, beforeID int64) ([]Event, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	query := `
SELECT id, level, message, cpu_percent, channels_json, created_at
FROM alert_events
`
	args := make([]any, 0, 2)
	if beforeID > 0 {
		query += `WHERE id < ? `
		args = append(args, beforeID)
	}
	query += `ORDER BY id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list alert events: %w", err)
	}
	defer rows.Close()

	events := make([]Event, 0, limit)
	for rows.Next() {
		var (
			e      Event
			level  string
			chJSON string
		)
		if err := rows.Scan(&e.ID, &level, &e.Message, &e.CPUPercent, &chJSON, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan alert event: %w", err)
		}
		e.Level = Level(level)
		e.Channels = decodeChannelResults(chJSON)
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate alert events: %w", err)
	}

	return events, nil
}

func (s *Store) CleanupEvents(retentionDays int) error {
	if retentionDays <= 0 {
		retentionDays = DefaultHistoryRetentionDays
	}
	deadline := time.Now().UTC().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	if _, err := s.db.Exec(`DELETE FROM alert_events WHERE created_at < ?`, deadline); err != nil {
		return fmt.Errorf("cleanup alert events: %w", err)
	}
	return nil
}

func (s *Store) SetMutedUntil(until *time.Time) error {
	var v any
	if until != nil {
		v = until.UTC()
	}
	_, err := s.db.Exec(`
UPDATE alert_silence
SET muted_until = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = 1
`, v)
	if err != nil {
		return fmt.Errorf("set muted_until: %w", err)
	}
	return nil
}

func (s *Store) GetMutedUntil() (*time.Time, error) {
	var raw sql.NullTime
	if err := s.db.QueryRow(`SELECT muted_until FROM alert_silence WHERE id = 1`).Scan(&raw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get muted_until: %w", err)
	}
	if !raw.Valid {
		return nil, nil
	}
	t := raw.Time.UTC()
	return &t, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func decodeStringSlice(v string) []string {
	if v == "" {
		return nil
	}
	var out []string
	if err := json.Unmarshal([]byte(v), &out); err != nil {
		return nil
	}
	return out
}

func decodeIntSlice(v string) []int {
	if v == "" {
		return nil
	}
	var out []int
	if err := json.Unmarshal([]byte(v), &out); err != nil {
		return nil
	}
	return out
}

func decodeChannelResults(v string) []ChannelResult {
	if v == "" {
		return nil
	}
	var out []ChannelResult
	if err := json.Unmarshal([]byte(v), &out); err != nil {
		return nil
	}
	return out
}
