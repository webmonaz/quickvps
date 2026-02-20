package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"quickvps/internal/auth"
	"quickvps/internal/metrics"
	"quickvps/internal/ncdu"
)

func newServerForAuthTests(t *testing.T) (*Server, *auth.Store, auth.User, auth.User) {
	t.Helper()

	storePath := filepath.Join(t.TempDir(), "server-auth.db")
	store, err := auth.NewStore(storePath)
	if err != nil {
		t.Fatalf("auth.NewStore() error = %v", err)
	}
	t.Cleanup(func() {
		_ = store.Close()
	})

	admin, err := store.CreateUser("admin", "secret123", auth.RoleAdmin)
	if err != nil {
		t.Fatalf("CreateUser(admin) error = %v", err)
	}

	viewer, err := store.CreateUser("viewer", "secret123", auth.RoleViewer)
	if err != nil {
		t.Fatalf("CreateUser(viewer) error = %v", err)
	}

	s := &Server{
		authDisabled: false,
		authStore:    store,
		sessions:     auth.NewSessionManager(2*time.Hour, store),
	}

	return s, store, admin, viewer
}

func withUser(req *http.Request, user auth.User) *http.Request {
	session := auth.Session{
		Token:     "ctx-token",
		UserID:    user.ID,
		Username:  user.Username,
		Role:      user.Role,
		ExpiresAt: time.Now().Add(time.Hour),
	}
	return req.WithContext(withSession(req.Context(), session))
}

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal() error = %v; body=%s", err, rec.Body.String())
	}
	return body
}

func newServerForSystemTests() (*Server, *metrics.Collector, *ncdu.Runner) {
	collector := metrics.NewCollector(2 * time.Second)
	runner := ncdu.NewRunner()

	s := &Server{
		collector: collector,
		runner:    runner,
	}

	return s, collector, runner
}

func TestHandleAuthLoginLogoutAndMeViaMiddleware(t *testing.T) {
	s, _, admin, _ := newServerForAuthTests(t)

	loginBody := []byte(`{"username":"admin","password":"secret123"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	s.handleAuthLogin(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("handleAuthLogin() status = %d, want %d", loginRec.Code, http.StatusOK)
	}

	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == sessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatalf("handleAuthLogin() session cookie missing")
	}

	meHandler := sessionAuthMiddleware(s, http.HandlerFunc(s.handleAuthMe))
	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(sessionCookie)
	meRec := httptest.NewRecorder()
	meHandler.ServeHTTP(meRec, meReq)

	if meRec.Code != http.StatusOK {
		t.Fatalf("handleAuthMe() via middleware status = %d, want %d", meRec.Code, http.StatusOK)
	}

	meBody := decodeBody(t, meRec)
	userObj, ok := meBody["user"].(map[string]any)
	if !ok {
		t.Fatalf("me body user missing: %v", meBody)
	}
	if userObj["username"] != admin.Username {
		t.Fatalf("me username = %v, want %q", userObj["username"], admin.Username)
	}

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	logoutRec := httptest.NewRecorder()
	s.handleAuthLogout(logoutRec, logoutReq)

	if logoutRec.Code != http.StatusOK {
		t.Fatalf("handleAuthLogout() status = %d, want %d", logoutRec.Code, http.StatusOK)
	}

	meAfterLogoutReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meAfterLogoutReq.AddCookie(sessionCookie)
	meAfterLogoutRec := httptest.NewRecorder()
	meHandler.ServeHTTP(meAfterLogoutRec, meAfterLogoutReq)
	if meAfterLogoutRec.Code != http.StatusUnauthorized {
		t.Fatalf("handleAuthMe() after logout status = %d, want %d", meAfterLogoutRec.Code, http.StatusUnauthorized)
	}
}

func TestHandleUsersAndUserByIDAndAudit(t *testing.T) {
	s, _, admin, _ := newServerForAuthTests(t)

	createReq := httptest.NewRequest(http.MethodPost, "/api/users", bytes.NewReader([]byte(`{"username":"newuser","password":"secret123"}`)))
	createReq = withUser(createReq, admin)
	createRec := httptest.NewRecorder()
	s.handleUsers(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("handleUsers(POST) status = %d, want %d", createRec.Code, http.StatusCreated)
	}

	createBody := decodeBody(t, createRec)
	createdUser, ok := createBody["user"].(map[string]any)
	if !ok {
		t.Fatalf("created user missing: %v", createBody)
	}
	if createdUser["role"] != string(auth.RoleViewer) {
		t.Fatalf("created role = %v, want %q", createdUser["role"], auth.RoleViewer)
	}

	createdIDFloat, ok := createdUser["id"].(float64)
	if !ok {
		t.Fatalf("created user id missing: %v", createdUser)
	}
	createdID := int64(createdIDFloat)

	listReq := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	listReq = withUser(listReq, admin)
	listRec := httptest.NewRecorder()
	s.handleUsers(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("handleUsers(GET) status = %d, want %d", listRec.Code, http.StatusOK)
	}

	roleAdmin := string(auth.RoleAdmin)
	updateReq := httptest.NewRequest(http.MethodPut, "/api/users/"+strconv.FormatInt(createdID, 10), bytes.NewReader([]byte(`{"role":"`+roleAdmin+`"}`)))
	updateReq = withUser(updateReq, admin)
	updateRec := httptest.NewRecorder()
	s.handleUserByID(updateRec, updateReq)
	if updateRec.Code != http.StatusOK {
		t.Fatalf("handleUserByID(PUT) status = %d, want %d", updateRec.Code, http.StatusOK)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/users/"+strconv.FormatInt(createdID, 10), nil)
	deleteReq = withUser(deleteReq, admin)
	deleteRec := httptest.NewRecorder()
	s.handleUserByID(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusOK {
		t.Fatalf("handleUserByID(DELETE) status = %d, want %d", deleteRec.Code, http.StatusOK)
	}

	auditReq := httptest.NewRequest(http.MethodGet, "/api/audit/users?limit=20", nil)
	auditReq = withUser(auditReq, admin)
	auditRec := httptest.NewRecorder()
	s.handleUserAudit(auditRec, auditReq)
	if auditRec.Code != http.StatusOK {
		t.Fatalf("handleUserAudit(GET) status = %d, want %d", auditRec.Code, http.StatusOK)
	}

	auditBody := decodeBody(t, auditRec)
	entries, ok := auditBody["entries"].([]any)
	if !ok {
		t.Fatalf("audit entries missing: %v", auditBody)
	}
	if len(entries) < 3 {
		t.Fatalf("audit entries len = %d, want at least 3", len(entries))
	}
}

func TestRequireAdminGuards(t *testing.T) {
	s, _, admin, viewer := newServerForAuthTests(t)

	noSessionReq := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	noSessionRec := httptest.NewRecorder()
	s.handleUsers(noSessionRec, noSessionReq)
	if noSessionRec.Code != http.StatusUnauthorized {
		t.Fatalf("handleUsers() without session status = %d, want %d", noSessionRec.Code, http.StatusUnauthorized)
	}

	viewerReq := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	viewerReq = withUser(viewerReq, viewer)
	viewerRec := httptest.NewRecorder()
	s.handleUsers(viewerRec, viewerReq)
	if viewerRec.Code != http.StatusForbidden {
		t.Fatalf("handleUsers() as viewer status = %d, want %d", viewerRec.Code, http.StatusForbidden)
	}

	selfDeleteReq := httptest.NewRequest(http.MethodDelete, "/api/users/"+strconv.FormatInt(admin.ID, 10), nil)
	selfDeleteReq = withUser(selfDeleteReq, admin)
	selfDeleteRec := httptest.NewRecorder()
	s.handleUserByID(selfDeleteRec, selfDeleteReq)
	if selfDeleteRec.Code != http.StatusBadRequest {
		t.Fatalf("handleUserByID(DELETE self) status = %d, want %d", selfDeleteRec.Code, http.StatusBadRequest)
	}

	badLimitReq := httptest.NewRequest(http.MethodGet, "/api/audit/users?limit=0", nil)
	badLimitReq = withUser(badLimitReq, admin)
	badLimitRec := httptest.NewRecorder()
	s.handleUserAudit(badLimitRec, badLimitReq)
	if badLimitRec.Code != http.StatusBadRequest {
		t.Fatalf("handleUserAudit(limit=0) status = %d, want %d", badLimitRec.Code, http.StatusBadRequest)
	}
}

func TestHandleIntervalGetPut(t *testing.T) {
	s, collector, _ := newServerForSystemTests()

	getReq := httptest.NewRequest(http.MethodGet, "/api/interval", nil)
	getRec := httptest.NewRecorder()
	s.handleInterval(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("handleInterval(GET) status = %d, want %d", getRec.Code, http.StatusOK)
	}

	getBody := decodeBody(t, getRec)
	intervalMS, ok := getBody["interval_ms"].(float64)
	if !ok {
		t.Fatalf("interval_ms missing in GET response: %v", getBody)
	}
	if int64(intervalMS) != collector.Interval().Milliseconds() {
		t.Fatalf("interval_ms = %d, want %d", int64(intervalMS), collector.Interval().Milliseconds())
	}

	badReq := httptest.NewRequest(http.MethodPut, "/api/interval", bytes.NewReader([]byte(`{"interval_ms":0}`)))
	badRec := httptest.NewRecorder()
	s.handleInterval(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("handleInterval(PUT invalid) status = %d, want %d", badRec.Code, http.StatusBadRequest)
	}

	putReq := httptest.NewRequest(http.MethodPut, "/api/interval", bytes.NewReader([]byte(`{"interval_ms":1500}`)))
	putRec := httptest.NewRecorder()
	s.handleInterval(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("handleInterval(PUT valid) status = %d, want %d", putRec.Code, http.StatusOK)
	}
	if collector.Interval() != 1500*time.Millisecond {
		t.Fatalf("collector.Interval() = %s, want %s", collector.Interval(), 1500*time.Millisecond)
	}
}

func TestHandleInfoIncludesExtendedFields(t *testing.T) {
	s, collector, runner := newServerForSystemTests()
	s.authDisabled = false
	originalLookPath := commandLookPath
	commandLookPath = func(file string) (string, error) {
		if file == "lsof" {
			return "", exec.ErrNotFound
		}
		return "/usr/bin/" + file, nil
	}
	t.Cleanup(func() {
		commandLookPath = originalLookPath
	})

	req := httptest.NewRequest(http.MethodGet, "/api/info", nil)
	rec := httptest.NewRecorder()
	s.handleInfo(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("handleInfo() status = %d, want %d", rec.Code, http.StatusOK)
	}

	body := decodeBody(t, rec)

	if body["hostname"] == nil {
		t.Fatalf("hostname missing: %v", body)
	}
	if body["os"] == nil {
		t.Fatalf("os missing: %v", body)
	}
	if body["arch"] == nil {
		t.Fatalf("arch missing: %v", body)
	}
	if body["uptime"] == nil {
		t.Fatalf("uptime missing: %v", body)
	}

	intervalMS, ok := body["interval_ms"].(float64)
	if !ok {
		t.Fatalf("interval_ms missing or invalid type: %v", body)
	}
	if int64(intervalMS) != collector.Interval().Milliseconds() {
		t.Fatalf("interval_ms = %d, want %d", int64(intervalMS), collector.Interval().Milliseconds())
	}

	cacheTTLSec, ok := body["ncdu_cache_ttl_sec"].(float64)
	if !ok {
		t.Fatalf("ncdu_cache_ttl_sec missing or invalid type: %v", body)
	}
	if int64(cacheTTLSec) != int64(runner.CacheTTL().Seconds()) {
		t.Fatalf("ncdu_cache_ttl_sec = %d, want %d", int64(cacheTTLSec), int64(runner.CacheTTL().Seconds()))
	}

	authEnabled, ok := body["auth_enabled"].(bool)
	if !ok {
		t.Fatalf("auth_enabled missing or invalid type: %v", body)
	}
	if !authEnabled {
		t.Fatalf("auth_enabled = false, want true")
	}

	localIP, ok := body["local_ip"].(string)
	if !ok || localIP == "" {
		t.Fatalf("local_ip missing or empty: %v", body)
	}
	publicIP, ok := body["public_ip"].(string)
	if !ok || publicIP == "" {
		t.Fatalf("public_ip missing or empty: %v", body)
	}
	if localIP != "unknown" && net.ParseIP(localIP) == nil {
		t.Fatalf("local_ip = %q, want valid IPv4 or unknown", localIP)
	}
	if publicIP != "unknown" && net.ParseIP(publicIP) == nil {
		t.Fatalf("public_ip = %q, want valid IPv4 or unknown", publicIP)
	}

	dnsServersRaw, ok := body["dns_servers"].([]any)
	if !ok {
		t.Fatalf("dns_servers missing or invalid type: %v", body)
	}
	for i, entry := range dnsServersRaw {
		s, ok := entry.(string)
		if !ok || s == "" {
			t.Fatalf("dns_servers[%d] invalid: %#v", i, entry)
		}
	}

	version, ok := body["version"].(string)
	if !ok || version == "" {
		t.Fatalf("version missing or empty: %v", body)
	}

	requiredPackagesRaw, ok := body["required_packages"].([]any)
	if !ok {
		t.Fatalf("required_packages missing or invalid type: %v", body)
	}
	if len(requiredPackagesRaw) != 2 {
		t.Fatalf("required_packages len = %d, want 2", len(requiredPackagesRaw))
	}

	seenByName := map[string]map[string]any{}
	for _, item := range requiredPackagesRaw {
		entry, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("required_packages entry invalid: %#v", item)
		}
		name, ok := entry["name"].(string)
		if !ok || name == "" {
			t.Fatalf("required_packages entry missing name: %#v", entry)
		}
		if _, ok := entry["installed"].(bool); !ok {
			t.Fatalf("required_packages[%s].installed missing or invalid: %#v", name, entry)
		}
		requiredFor, ok := entry["required_for"].(string)
		if !ok || requiredFor == "" {
			t.Fatalf("required_packages[%s].required_for missing or invalid: %#v", name, entry)
		}
		seenByName[name] = entry
	}

	if _, ok := seenByName["lsof"]; !ok {
		t.Fatalf("required_packages missing lsof entry: %#v", requiredPackagesRaw)
	}
	if _, ok := seenByName["ncdu"]; !ok {
		t.Fatalf("required_packages missing ncdu entry: %#v", requiredPackagesRaw)
	}
	if installed, _ := seenByName["lsof"]["installed"].(bool); installed {
		t.Fatalf("required_packages lsof installed = true, want false")
	}
	if installed, _ := seenByName["ncdu"]["installed"].(bool); !installed {
		t.Fatalf("required_packages ncdu installed = false, want true")
	}

	missingRaw, ok := body["missing_required_packages"].([]any)
	if !ok {
		t.Fatalf("missing_required_packages missing or invalid type: %v", body)
	}
	if len(missingRaw) != 1 {
		t.Fatalf("missing_required_packages len = %d, want 1", len(missingRaw))
	}
	if missingName, ok := missingRaw[0].(string); !ok || missingName != "lsof" {
		t.Fatalf("missing_required_packages[0] = %#v, want %q", missingRaw[0], "lsof")
	}

	installCmd, ok := body["required_packages_install_cmd"].(string)
	if !ok {
		t.Fatalf("required_packages_install_cmd missing or invalid type: %v", body)
	}
	if !strings.Contains(installCmd, "lsof") {
		t.Fatalf("required_packages_install_cmd = %q, want to contain lsof", installCmd)
	}

	if _, ok := body["alerts_enabled"].(bool); !ok {
		t.Fatalf("alerts_enabled missing or invalid type: %v", body)
	}
	if _, ok := body["alerts_read_only"].(bool); !ok {
		t.Fatalf("alerts_read_only missing or invalid type: %v", body)
	}
	if _, ok := body["alerts_history_retention_days"].(float64); !ok {
		t.Fatalf("alerts_history_retention_days missing or invalid type: %v", body)
	}
}

func TestGetLocalIPsUsesResolvedPublicIPv4(t *testing.T) {
	origDetectLocal := detectPrimaryLocalIPv4
	origDetectPublic := detectPublicIPv4
	detectPrimaryLocalIPv4 = func() string { return "192.168.1.20" }
	detectPublicIPv4 = func(context.Context) (string, error) { return "203.0.113.42", nil }
	t.Cleanup(func() {
		detectPrimaryLocalIPv4 = origDetectLocal
		detectPublicIPv4 = origDetectPublic
	})

	localIP, publicIP := getLocalIPs(context.Background())
	if localIP != "192.168.1.20" {
		t.Fatalf("localIP = %q, want %q", localIP, "192.168.1.20")
	}
	if publicIP != "203.0.113.42" {
		t.Fatalf("publicIP = %q, want %q", publicIP, "203.0.113.42")
	}
}

func TestGetLocalIPsFallsBackToLocalWhenPublicLookupFails(t *testing.T) {
	origDetectLocal := detectPrimaryLocalIPv4
	origDetectPublic := detectPublicIPv4
	detectPrimaryLocalIPv4 = func() string { return "10.0.0.5" }
	detectPublicIPv4 = func(context.Context) (string, error) { return "", errors.New("lookup failed") }
	t.Cleanup(func() {
		detectPrimaryLocalIPv4 = origDetectLocal
		detectPublicIPv4 = origDetectPublic
	})

	localIP, publicIP := getLocalIPs(context.Background())
	if localIP != "10.0.0.5" {
		t.Fatalf("localIP = %q, want %q", localIP, "10.0.0.5")
	}
	if publicIP != "10.0.0.5" {
		t.Fatalf("publicIP = %q, want %q", publicIP, "10.0.0.5")
	}
}

func TestGetLocalIPsReturnsUnknownWhenLocalUnavailable(t *testing.T) {
	origDetectLocal := detectPrimaryLocalIPv4
	origDetectPublic := detectPublicIPv4
	detectPrimaryLocalIPv4 = func() string { return "" }
	detectPublicIPv4 = func(context.Context) (string, error) { return "", errors.New("lookup failed") }
	t.Cleanup(func() {
		detectPrimaryLocalIPv4 = origDetectLocal
		detectPublicIPv4 = origDetectPublic
	})

	localIP, publicIP := getLocalIPs(context.Background())
	if localIP != "unknown" {
		t.Fatalf("localIP = %q, want %q", localIP, "unknown")
	}
	if publicIP != "unknown" {
		t.Fatalf("publicIP = %q, want %q", publicIP, "unknown")
	}
}

func TestHandleNcduCacheStatusAndCancel(t *testing.T) {
	s, _, runner := newServerForSystemTests()

	cacheGetReq := httptest.NewRequest(http.MethodGet, "/api/ncdu/cache", nil)
	cacheGetRec := httptest.NewRecorder()
	s.handleNcduCache(cacheGetRec, cacheGetReq)
	if cacheGetRec.Code != http.StatusOK {
		t.Fatalf("handleNcduCache(GET) status = %d, want %d", cacheGetRec.Code, http.StatusOK)
	}

	cacheGetBody := decodeBody(t, cacheGetRec)
	ttlSec, ok := cacheGetBody["cache_ttl_sec"].(float64)
	if !ok {
		t.Fatalf("cache_ttl_sec missing in GET response: %v", cacheGetBody)
	}
	if int64(ttlSec) != int64(runner.CacheTTL().Seconds()) {
		t.Fatalf("cache_ttl_sec = %d, want %d", int64(ttlSec), int64(runner.CacheTTL().Seconds()))
	}

	cacheBadReq := httptest.NewRequest(http.MethodPut, "/api/ncdu/cache", bytes.NewReader([]byte(`{"cache_ttl_sec":0}`)))
	cacheBadRec := httptest.NewRecorder()
	s.handleNcduCache(cacheBadRec, cacheBadReq)
	if cacheBadRec.Code != http.StatusBadRequest {
		t.Fatalf("handleNcduCache(PUT invalid) status = %d, want %d", cacheBadRec.Code, http.StatusBadRequest)
	}

	cachePutReq := httptest.NewRequest(http.MethodPut, "/api/ncdu/cache", bytes.NewReader([]byte(`{"cache_ttl_sec":120}`)))
	cachePutRec := httptest.NewRecorder()
	s.handleNcduCache(cachePutRec, cachePutReq)
	if cachePutRec.Code != http.StatusOK {
		t.Fatalf("handleNcduCache(PUT valid) status = %d, want %d", cachePutRec.Code, http.StatusOK)
	}
	if runner.CacheTTL() != 120*time.Second {
		t.Fatalf("runner.CacheTTL() = %s, want %s", runner.CacheTTL(), 120*time.Second)
	}

	statusReq := httptest.NewRequest(http.MethodGet, "/api/ncdu/status", nil)
	statusRec := httptest.NewRecorder()
	s.handleNcduStatus(statusRec, statusReq)
	if statusRec.Code != http.StatusOK {
		t.Fatalf("handleNcduStatus(GET) status = %d, want %d", statusRec.Code, http.StatusOK)
	}

	statusBody := decodeBody(t, statusRec)
	if statusBody["status"] != string(ncdu.StatusIdle) {
		t.Fatalf("status = %v, want %q", statusBody["status"], ncdu.StatusIdle)
	}

	cancelReq := httptest.NewRequest(http.MethodDelete, "/api/ncdu/scan", nil)
	cancelRec := httptest.NewRecorder()
	s.handleNcduScan(cancelRec, cancelReq)
	if cancelRec.Code != http.StatusOK {
		t.Fatalf("handleNcduScan(DELETE) status = %d, want %d", cancelRec.Code, http.StatusOK)
	}

	if runner.Result().Status != ncdu.StatusIdle {
		t.Fatalf("runner.Result().Status = %q, want %q", runner.Result().Status, ncdu.StatusIdle)
	}
}
