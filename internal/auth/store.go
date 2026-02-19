package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserExists         = errors.New("user already exists")
	ErrInvalidRole        = errors.New("invalid role")
	ErrInvalidUsername    = errors.New("invalid username")
	ErrInvalidPassword    = errors.New("invalid password")
	ErrNotFound           = errors.New("not found")
	ErrLastAdmin          = errors.New("cannot remove the last admin")
)

type Store struct {
	db *sql.DB
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
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
	token TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL,
	username TEXT NOT NULL,
	role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
	expires_at DATETIME NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS audit_user_actions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	actor_user_id INTEGER NOT NULL,
	actor_username TEXT NOT NULL,
	action TEXT NOT NULL,
	target_user_id INTEGER NOT NULL,
	target_username TEXT NOT NULL,
	details TEXT NOT NULL DEFAULT '',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user_actions_created_at ON audit_user_actions(created_at DESC);
`
	if _, err := s.db.Exec(schema); err != nil {
		return fmt.Errorf("migrate users table: %w", err)
	}
	return nil
}

func normalizeRole(role Role) (Role, error) {
	switch Role(strings.ToLower(strings.TrimSpace(string(role)))) {
	case RoleAdmin:
		return RoleAdmin, nil
	case RoleViewer:
		return RoleViewer, nil
	default:
		return "", ErrInvalidRole
	}
}

func normalizeUsername(username string) (string, error) {
	username = strings.TrimSpace(username)
	if len(username) < 3 {
		return "", ErrInvalidUsername
	}
	return username, nil
}

func validatePassword(password string) error {
	if len(password) < 6 {
		return ErrInvalidPassword
	}
	return nil
}

func (s *Store) SeedAdmin(username, password string) error {
	count, err := s.CountUsers()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	if password == "" {
		return nil
	}
	_, err = s.CreateUser(username, password, RoleAdmin)
	return err
}

func (s *Store) CountUsers() (int64, error) {
	var count int64
	if err := s.db.QueryRow(`SELECT COUNT(1) FROM users`).Scan(&count); err != nil {
		return 0, fmt.Errorf("count users: %w", err)
	}
	return count, nil
}

func (s *Store) CreateUser(username, password string, role Role) (User, error) {
	var user User

	cleanUsername, err := normalizeUsername(username)
	if err != nil {
		return user, err
	}
	cleanRole, err := normalizeRole(role)
	if err != nil {
		return user, err
	}
	if err := validatePassword(password); err != nil {
		return user, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return user, fmt.Errorf("hash password: %w", err)
	}

	res, err := s.db.Exec(`
INSERT INTO users (username, password_hash, role)
VALUES (?, ?, ?)
`, cleanUsername, string(hash), string(cleanRole))
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return user, ErrUserExists
		}
		return user, fmt.Errorf("insert user: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return user, fmt.Errorf("last insert id: %w", err)
	}

	return User{ID: id, Username: cleanUsername, Role: cleanRole}, nil
}

func (s *Store) Authenticate(username, password string) (User, error) {
	var (
		user User
		hash string
	)

	cleanUsername, err := normalizeUsername(username)
	if err != nil {
		return user, ErrInvalidCredentials
	}

	err = s.db.QueryRow(`
SELECT id, username, role, password_hash
FROM users
WHERE username = ?
`, cleanUsername).Scan(&user.ID, &user.Username, &user.Role, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return user, ErrInvalidCredentials
	}
	if err != nil {
		return user, fmt.Errorf("query user: %w", err)
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return User{}, ErrInvalidCredentials
	}

	return user, nil
}

func (s *Store) GetUserByID(id int64) (User, error) {
	var user User
	err := s.db.QueryRow(`
SELECT id, username, role
FROM users
WHERE id = ?
`, id).Scan(&user.ID, &user.Username, &user.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return user, ErrNotFound
	}
	if err != nil {
		return user, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (s *Store) ListUsers() ([]User, error) {
	rows, err := s.db.Query(`
SELECT id, username, role
FROM users
ORDER BY id ASC
`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0, 8)
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Username, &user.Role); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (s *Store) CountAdmins() (int64, error) {
	var count int64
	if err := s.db.QueryRow(`SELECT COUNT(1) FROM users WHERE role = ?`, string(RoleAdmin)).Scan(&count); err != nil {
		return 0, fmt.Errorf("count admins: %w", err)
	}
	return count, nil
}

func (s *Store) UpdateUser(id int64, role *Role, password *string) (User, error) {
	current, err := s.GetUserByID(id)
	if err != nil {
		return User{}, err
	}

	if role != nil {
		cleanRole, err := normalizeRole(*role)
		if err != nil {
			return User{}, err
		}
		if current.Role == RoleAdmin && cleanRole != RoleAdmin {
			adminCount, err := s.CountAdmins()
			if err != nil {
				return User{}, err
			}
			if adminCount <= 1 {
				return User{}, ErrLastAdmin
			}
		}
		if _, err := s.db.Exec(`UPDATE users SET role = ? WHERE id = ?`, string(cleanRole), id); err != nil {
			return User{}, fmt.Errorf("update user role: %w", err)
		}
		current.Role = cleanRole
	}

	if password != nil {
		if err := validatePassword(*password); err != nil {
			return User{}, err
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
		if err != nil {
			return User{}, fmt.Errorf("hash password: %w", err)
		}
		if _, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, string(hash), id); err != nil {
			return User{}, fmt.Errorf("update user password: %w", err)
		}
	}

	return s.GetUserByID(id)
}

func (s *Store) DeleteUser(id int64) error {
	target, err := s.GetUserByID(id)
	if err != nil {
		return err
	}

	if target.Role == RoleAdmin {
		adminCount, err := s.CountAdmins()
		if err != nil {
			return err
		}
		if adminCount <= 1 {
			return ErrLastAdmin
		}
	}

	res, err := s.db.Exec(`DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SaveSession(session Session) error {
	_, err := s.db.Exec(`
INSERT INTO sessions (token, user_id, username, role, expires_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(token) DO UPDATE SET
  user_id = excluded.user_id,
  username = excluded.username,
  role = excluded.role,
  expires_at = excluded.expires_at
`, session.Token, session.UserID, session.Username, string(session.Role), session.ExpiresAt.UTC())
	if err != nil {
		return fmt.Errorf("save session: %w", err)
	}
	return nil
}

func (s *Store) GetSession(token string) (Session, bool, error) {
	var session Session
	var role string

	err := s.db.QueryRow(`
SELECT token, user_id, username, role, expires_at
FROM sessions
WHERE token = ?
`, token).Scan(&session.Token, &session.UserID, &session.Username, &role, &session.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, false, nil
	}
	if err != nil {
		return Session{}, false, fmt.Errorf("get session: %w", err)
	}

	session.Role = Role(role)
	return session, true, nil
}

func (s *Store) DeleteSession(token string) error {
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE token = ?`, token); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (s *Store) DeleteSessionsByUserID(userID int64) error {
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE user_id = ?`, userID); err != nil {
		return fmt.Errorf("delete sessions by user: %w", err)
	}
	return nil
}

func (s *Store) DeleteExpiredSessions(now time.Time) error {
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE expires_at <= ?`, now.UTC()); err != nil {
		return fmt.Errorf("delete expired sessions: %w", err)
	}
	return nil
}

func (s *Store) LogUserAudit(
	actorUserID int64,
	actorUsername string,
	action string,
	targetUserID int64,
	targetUsername string,
	details string,
) error {
	if strings.TrimSpace(action) == "" {
		return fmt.Errorf("log user audit: empty action")
	}

	_, err := s.db.Exec(`
INSERT INTO audit_user_actions (
	actor_user_id,
	actor_username,
	action,
	target_user_id,
	target_username,
	details
) VALUES (?, ?, ?, ?, ?, ?)
`, actorUserID, actorUsername, action, targetUserID, targetUsername, details)
	if err != nil {
		return fmt.Errorf("log user audit: %w", err)
	}
	return nil
}

func (s *Store) ListUserAudits(limit int) ([]UserAuditEntry, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	rows, err := s.db.Query(`
SELECT id, actor_user_id, actor_username, action, target_user_id, target_username, details, created_at
FROM audit_user_actions
ORDER BY created_at DESC, id DESC
LIMIT ?
`, limit)
	if err != nil {
		return nil, fmt.Errorf("list user audits: %w", err)
	}
	defer rows.Close()

	entries := make([]UserAuditEntry, 0, limit)
	for rows.Next() {
		var entry UserAuditEntry
		if err := rows.Scan(
			&entry.ID,
			&entry.ActorUserID,
			&entry.ActorUsername,
			&entry.Action,
			&entry.TargetUserID,
			&entry.TargetUsername,
			&entry.Details,
			&entry.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan user audit: %w", err)
		}
		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user audits: %w", err)
	}

	return entries, nil
}
