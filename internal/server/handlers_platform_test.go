package server

import (
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
)

func TestLinuxOnlyFirewallAndPackageEndpoints(t *testing.T) {
	if runtime.GOOS == "linux" {
		t.Skip("linux-only guard test is for non-linux runtime")
	}

	s, _, _ := newServerForSystemTests()

	fwReq := httptest.NewRequest(http.MethodGet, "/api/firewall/status", nil)
	fwRec := httptest.NewRecorder()
	s.handleFirewallStatus(fwRec, fwReq)
	if fwRec.Code != http.StatusNotImplemented {
		t.Fatalf("handleFirewallStatus() status = %d, want %d", fwRec.Code, http.StatusNotImplemented)
	}

	pkgReq := httptest.NewRequest(http.MethodGet, "/api/packages/inventory", nil)
	pkgRec := httptest.NewRecorder()
	s.handlePackagesInventory(pkgRec, pkgReq)
	if pkgRec.Code != http.StatusNotImplemented {
		t.Fatalf("handlePackagesInventory() status = %d, want %d", pkgRec.Code, http.StatusNotImplemented)
	}
}
