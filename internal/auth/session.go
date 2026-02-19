package auth

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

type Session struct {
	Token     string
	UserID    int64
	Username  string
	Role      Role
	ExpiresAt time.Time
}

type SessionManager struct {
	mu       sync.RWMutex
	ttl      time.Duration
	store    *Store
	sessions map[string]Session
}

func NewSessionManager(ttl time.Duration, store *Store) *SessionManager {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &SessionManager{
		ttl:      ttl,
		store:    store,
		sessions: make(map[string]Session),
	}
}

func (m *SessionManager) Create(user User) (Session, error) {
	token, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}

	now := time.Now()
	s := Session{
		Token:     token,
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: now.Add(m.ttl),
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[token] = s
	if m.store != nil {
		if err := m.store.SaveSession(s); err != nil {
			delete(m.sessions, token)
			return Session{}, err
		}
	}

	return s, nil
}

func (m *SessionManager) Get(token string) (Session, bool) {
	now := time.Now()

	m.mu.RLock()
	session, ok := m.sessions[token]
	m.mu.RUnlock()
	if ok {
		if now.After(session.ExpiresAt) {
			m.Delete(token)
			return Session{}, false
		}
		return session, true
	}

	if m.store == nil {
		return Session{}, false
	}

	if err := m.store.DeleteExpiredSessions(now); err != nil {
		return Session{}, false
	}

	persisted, found, err := m.store.GetSession(token)
	if err != nil || !found {
		return Session{}, false
	}
	if now.After(persisted.ExpiresAt) {
		m.Delete(token)
		return Session{}, false
	}

	m.mu.Lock()
	m.sessions[token] = persisted
	m.mu.Unlock()

	return persisted, true
}

func (m *SessionManager) Delete(token string) {
	m.mu.Lock()
	delete(m.sessions, token)
	m.mu.Unlock()

	if m.store != nil {
		_ = m.store.DeleteSession(token)
	}
}

func (m *SessionManager) DeleteByUserID(userID int64) {
	m.mu.Lock()
	for token, session := range m.sessions {
		if session.UserID == userID {
			delete(m.sessions, token)
		}
	}
	m.mu.Unlock()

	if m.store != nil {
		_ = m.store.DeleteSessionsByUserID(userID)
	}
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
