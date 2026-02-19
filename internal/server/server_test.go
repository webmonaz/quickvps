package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"quickvps/internal/auth"
)

func TestIsPublicPath(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{path: "/", want: true},
		{path: "/dashboard", want: true},
		{path: "/api/auth/login", want: true},
		{path: "/api/info", want: false},
		{path: "/api/metrics", want: false},
		{path: "/ws", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicPath(tt.path)
			if got != tt.want {
				t.Fatalf("isPublicPath(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestWriteUnauthorized(t *testing.T) {
	rec := httptest.NewRecorder()

	writeUnauthorized(rec)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content type = %q, want application/json", got)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body error = %v", err)
	}
	if body["error"] != "unauthorized" {
		t.Fatalf("body error = %q, want unauthorized", body["error"])
	}
}

func TestSessionContextHelpers(t *testing.T) {
	session := auth.Session{Token: "abc", UserID: 42, Username: "admin", Role: auth.RoleAdmin}

	ctx := withSession(context.Background(), session)
	got, ok := sessionFromContext(ctx)
	if !ok {
		t.Fatalf("sessionFromContext() ok = false, want true")
	}
	if got.Token != session.Token || got.UserID != session.UserID {
		t.Fatalf("sessionFromContext() = %+v, want %+v", got, session)
	}

	if _, ok := sessionFromContext(context.Background()); ok {
		t.Fatalf("sessionFromContext() ok = true for empty context, want false")
	}
}
