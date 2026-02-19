package auth

import (
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()

	path := filepath.Join(t.TempDir(), "auth-test.db")
	store, err := NewStore(path)
	if err != nil {
		t.Fatalf("NewStore() error = %v", err)
	}

	t.Cleanup(func() {
		_ = store.Close()
	})

	return store
}

func TestNormalizeHelpers(t *testing.T) {
	t.Run("normalizeRole", func(t *testing.T) {
		role, err := normalizeRole(Role("  AdMiN  "))
		if err != nil {
			t.Fatalf("normalizeRole() unexpected error = %v", err)
		}
		if role != RoleAdmin {
			t.Fatalf("normalizeRole() = %q, want %q", role, RoleAdmin)
		}

		_, err = normalizeRole(Role("owner"))
		if !errors.Is(err, ErrInvalidRole) {
			t.Fatalf("normalizeRole() invalid role error = %v, want %v", err, ErrInvalidRole)
		}
	})

	t.Run("normalizeUsername", func(t *testing.T) {
		username, err := normalizeUsername("  alice  ")
		if err != nil {
			t.Fatalf("normalizeUsername() unexpected error = %v", err)
		}
		if username != "alice" {
			t.Fatalf("normalizeUsername() = %q, want %q", username, "alice")
		}

		_, err = normalizeUsername("ab")
		if !errors.Is(err, ErrInvalidUsername) {
			t.Fatalf("normalizeUsername() invalid username error = %v, want %v", err, ErrInvalidUsername)
		}
	})

	t.Run("validatePassword", func(t *testing.T) {
		if err := validatePassword("12345"); !errors.Is(err, ErrInvalidPassword) {
			t.Fatalf("validatePassword() short password error = %v, want %v", err, ErrInvalidPassword)
		}
		if err := validatePassword("123456"); err != nil {
			t.Fatalf("validatePassword() unexpected error = %v", err)
		}
	})
}

func TestStoreCreateAuthenticateAndDuplicate(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateUser("  alice  ", "secret123", RoleAdmin)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}
	if created.Username != "alice" {
		t.Fatalf("CreateUser() username = %q, want %q", created.Username, "alice")
	}
	if created.Role != RoleAdmin {
		t.Fatalf("CreateUser() role = %q, want %q", created.Role, RoleAdmin)
	}

	_, err = store.CreateUser("alice", "secret123", RoleViewer)
	if !errors.Is(err, ErrUserExists) {
		t.Fatalf("CreateUser() duplicate error = %v, want %v", err, ErrUserExists)
	}

	authed, err := store.Authenticate(" alice ", "secret123")
	if err != nil {
		t.Fatalf("Authenticate() error = %v", err)
	}
	if authed.ID != created.ID {
		t.Fatalf("Authenticate() user id = %d, want %d", authed.ID, created.ID)
	}

	_, err = store.Authenticate("alice", "wrong-pass")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Authenticate() wrong password error = %v, want %v", err, ErrInvalidCredentials)
	}
}

func TestStoreLastAdminProtection(t *testing.T) {
	store := newTestStore(t)

	admin, err := store.CreateUser("admin", "secret123", RoleAdmin)
	if err != nil {
		t.Fatalf("CreateUser(admin) error = %v", err)
	}

	viewerRole := RoleViewer
	_, err = store.UpdateUser(admin.ID, &viewerRole, nil)
	if !errors.Is(err, ErrLastAdmin) {
		t.Fatalf("UpdateUser() demote last admin error = %v, want %v", err, ErrLastAdmin)
	}

	err = store.DeleteUser(admin.ID)
	if !errors.Is(err, ErrLastAdmin) {
		t.Fatalf("DeleteUser() last admin error = %v, want %v", err, ErrLastAdmin)
	}

	_, err = store.CreateUser("admin2", "secret123", RoleAdmin)
	if err != nil {
		t.Fatalf("CreateUser(admin2) error = %v", err)
	}

	updated, err := store.UpdateUser(admin.ID, &viewerRole, nil)
	if err != nil {
		t.Fatalf("UpdateUser() error = %v", err)
	}
	if updated.Role != RoleViewer {
		t.Fatalf("UpdateUser() role = %q, want %q", updated.Role, RoleViewer)
	}
}

func TestStoreSessionAndAuditOperations(t *testing.T) {
	store := newTestStore(t)

	user, err := store.CreateUser("bob", "secret123", RoleViewer)
	if err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	now := time.Now().UTC()
	expired := Session{
		Token:     "expired-token",
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: now.Add(-time.Minute),
	}
	active := Session{
		Token:     "active-token",
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: now.Add(time.Hour),
	}

	if err := store.SaveSession(expired); err != nil {
		t.Fatalf("SaveSession(expired) error = %v", err)
	}
	if err := store.SaveSession(active); err != nil {
		t.Fatalf("SaveSession(active) error = %v", err)
	}

	if err := store.DeleteExpiredSessions(now); err != nil {
		t.Fatalf("DeleteExpiredSessions() error = %v", err)
	}

	_, found, err := store.GetSession(expired.Token)
	if err != nil {
		t.Fatalf("GetSession(expired) error = %v", err)
	}
	if found {
		t.Fatalf("GetSession(expired) found = true, want false")
	}

	loaded, found, err := store.GetSession(active.Token)
	if err != nil {
		t.Fatalf("GetSession(active) error = %v", err)
	}
	if !found {
		t.Fatalf("GetSession(active) found = false, want true")
	}
	if loaded.UserID != user.ID {
		t.Fatalf("GetSession(active) userID = %d, want %d", loaded.UserID, user.ID)
	}

	if err := store.LogUserAudit(user.ID, user.Username, "update_role", user.ID, user.Username, "role:viewer"); err != nil {
		t.Fatalf("LogUserAudit() error = %v", err)
	}

	audits, err := store.ListUserAudits(10)
	if err != nil {
		t.Fatalf("ListUserAudits() error = %v", err)
	}
	if len(audits) != 1 {
		t.Fatalf("ListUserAudits() len = %d, want 1", len(audits))
	}
	if audits[0].Action != "update_role" {
		t.Fatalf("ListUserAudits() action = %q, want %q", audits[0].Action, "update_role")
	}
}
