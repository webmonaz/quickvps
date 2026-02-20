package firewall

import "testing"

func TestParsePortSet(t *testing.T) {
	ports := parsePortSet("22, 443,invalid,70000,53")
	if _, ok := ports[22]; !ok {
		t.Fatalf("expected port 22 in set")
	}
	if _, ok := ports[443]; !ok {
		t.Fatalf("expected port 443 in set")
	}
	if _, ok := ports[53]; !ok {
		t.Fatalf("expected port 53 in set")
	}
	if _, ok := ports[70000]; ok {
		t.Fatalf("did not expect out-of-range port")
	}
}

func TestExposureRiskWithPolicy(t *testing.T) {
	policy := RiskPolicy{
		HighRiskPorts:   map[int]struct{}{3306: {}},
		MediumRiskPorts: map[int]struct{}{22: {}},
	}

	risk, _ := exposureRisk(3306, true, policy)
	if risk != "high" {
		t.Fatalf("risk = %q, want high", risk)
	}

	risk, _ = exposureRisk(22, true, policy)
	if risk != "medium" {
		t.Fatalf("risk = %q, want medium", risk)
	}

	risk, _ = exposureRisk(8080, true, policy)
	if risk != "low" {
		t.Fatalf("risk = %q, want low", risk)
	}
}
