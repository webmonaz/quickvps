package auth

import (
	"path/filepath"
	"testing"
	"time"
)

func newSessionTestStore(t *testing.T) *Store {
	t.Helper()

	path := filepath.Join(t.TempDir(), "session-test.db")
	store, err := NewStore(path)
	if err != nil {
		t.Fatalf("NewStore() error = %v", err)
	}
	t.Cleanup(func() {
		_ = store.Close()
	})

	return store
}

func TestSessionManagerCreateGetDelete(t *testing.T) {
	mgr := NewSessionManager(2*time.Hour, nil)
	user := User{ID: 7, Username: "alice", Role: RoleAdmin}

	s, err := mgr.Create(user)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if len(s.Token) != 64 {
		t.Fatalf("Create() token length = %d, want 64", len(s.Token))
	}

	got, ok := mgr.Get(s.Token)
	if !ok {
		t.Fatalf("Get() ok = false, want true")
	}
	if got.UserID != user.ID {
		t.Fatalf("Get() user id = %d, want %d", got.UserID, user.ID)
	}

	mgr.Delete(s.Token)
	if _, ok := mgr.Get(s.Token); ok {
		t.Fatalf("Get() ok = true after delete, want false")
	}
}

func TestSessionManagerGetExpiresInMemory(t *testing.T) {
	mgr := NewSessionManager(time.Hour, nil)
	token := "expired"
	mgr.sessions[token] = Session{
		Token:     token,
		UserID:    1,
		Username:  "u",
		Role:      RoleViewer,
		ExpiresAt: time.Now().Add(-time.Second),
	}

	if _, ok := mgr.Get(token); ok {
		t.Fatalf("Get() ok = true for expired session, want false")
	}

	mgr.mu.RLock()
	_, stillPresent := mgr.sessions[token]
	mgr.mu.RUnlock()
	if stillPresent {
		t.Fatalf("expired session still in map, want deleted")
	}
}

func TestSessionManagerLoadsFromStoreAndCaches(t *testing.T) {
	store := newSessionTestStore(t)
	user, err := store.CreateUser("viewer1", "secret123", RoleViewer)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	persisted := Session{
		Token:     "persisted-token",
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: time.Now().Add(time.Hour),
	}
	if err := store.SaveSession(persisted); err != nil {
		t.Fatalf("SaveSession() error = %v", err)
	}

	mgr := NewSessionManager(time.Hour, store)
	got, ok := mgr.Get(persisted.Token)
	if !ok {
		t.Fatalf("Get() ok = false, want true")
	}
	if got.Username != persisted.Username {
		t.Fatalf("Get() username = %q, want %q", got.Username, persisted.Username)
	}

	mgr.mu.RLock()
	_, cached := mgr.sessions[persisted.Token]
	mgr.mu.RUnlock()
	if !cached {
		t.Fatalf("session not cached in memory after store load")
	}
}
