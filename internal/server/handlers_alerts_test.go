package server

import (
	"bytes"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"quickvps/internal/alerts"
)

func newAlertsServiceForTests(t *testing.T) *alerts.Service {
	t.Helper()
	storePath := filepath.Join(t.TempDir(), "alerts.db")
	store, err := alerts.NewStore(storePath)
	if err != nil {
		t.Fatalf("alerts.NewStore() error = %v", err)
	}
	t.Cleanup(func() {
		_ = store.Close()
	})

	key := base64.StdEncoding.EncodeToString([]byte(strings.Repeat("k", 32)))
	svc, err := alerts.NewService(store, alerts.NewNotifier(), key)
	if err != nil {
		t.Fatalf("alerts.NewService() error = %v", err)
	}
	return svc
}

func TestHandleAlertsConfigGetPutAndRBAC(t *testing.T) {
	s, _, admin, viewer := newServerForAuthTests(t)
	s.alerts = newAlertsServiceForTests(t)

	getReq := httptest.NewRequest(http.MethodGet, "/api/alerts/config", nil)
	getReq = withUser(getReq, viewer)
	getRec := httptest.NewRecorder()
	s.handleAlertsConfig(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("handleAlertsConfig(GET) status = %d, want %d", getRec.Code, http.StatusOK)
	}

	viewerPutReq := httptest.NewRequest(http.MethodPut, "/api/alerts/config", bytes.NewReader([]byte(`{"warning_percent":80}`)))
	viewerPutReq = withUser(viewerPutReq, viewer)
	viewerPutRec := httptest.NewRecorder()
	s.handleAlertsConfig(viewerPutRec, viewerPutReq)
	if viewerPutRec.Code != http.StatusForbidden {
		t.Fatalf("handleAlertsConfig(PUT viewer) status = %d, want %d", viewerPutRec.Code, http.StatusForbidden)
	}

	badReq := httptest.NewRequest(http.MethodPut, "/api/alerts/config", bytes.NewReader([]byte(`{"warning_percent":95,"critical_percent":90}`)))
	badReq = withUser(badReq, admin)
	badRec := httptest.NewRecorder()
	s.handleAlertsConfig(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("handleAlertsConfig(PUT invalid) status = %d, want %d", badRec.Code, http.StatusBadRequest)
	}

	putReq := httptest.NewRequest(http.MethodPut, "/api/alerts/config", bytes.NewReader([]byte(`{"warning_percent":78,"critical_percent":88,"recovery_percent":68}`)))
	putReq = withUser(putReq, admin)
	putRec := httptest.NewRecorder()
	s.handleAlertsConfig(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("handleAlertsConfig(PUT valid) status = %d, want %d body=%s", putRec.Code, http.StatusOK, putRec.Body.String())
	}

	body := decodeBody(t, putRec)
	if body["warning_percent"] == nil {
		t.Fatalf("warning_percent missing from response: %v", body)
	}
}

func TestHandleAlertsPublicModeReadOnly(t *testing.T) {
	s, _, _ := newServerForSystemTests()
	s.authDisabled = true
	s.alerts = newAlertsServiceForTests(t)

	putReq := httptest.NewRequest(http.MethodPut, "/api/alerts/config", bytes.NewReader([]byte(`{"enabled":false}`)))
	putRec := httptest.NewRecorder()
	s.handleAlertsConfig(putRec, putReq)
	if putRec.Code != http.StatusForbidden {
		t.Fatalf("handleAlertsConfig(PUT public mode) status = %d, want %d", putRec.Code, http.StatusForbidden)
	}

	statusReq := httptest.NewRequest(http.MethodGet, "/api/alerts/status", nil)
	statusRec := httptest.NewRecorder()
	s.handleAlertsStatus(statusRec, statusReq)
	if statusRec.Code != http.StatusOK {
		t.Fatalf("handleAlertsStatus(GET) status = %d, want %d", statusRec.Code, http.StatusOK)
	}

	statusBody := decodeBody(t, statusRec)
	readOnly, ok := statusBody["read_only"].(bool)
	if !ok || !readOnly {
		t.Fatalf("read_only = %v, want true", statusBody["read_only"])
	}
}
