package firewall

import (
	"os"
	"strconv"
	"strings"
)

type RiskPolicy struct {
	HighRiskPorts   map[int]struct{}
	MediumRiskPorts map[int]struct{}
}

func DefaultRiskPolicy() RiskPolicy {
	return RiskPolicy{
		HighRiskPorts:   map[int]struct{}{3306: {}, 5432: {}, 6379: {}, 27017: {}, 11211: {}},
		MediumRiskPorts: map[int]struct{}{22: {}, 25: {}},
	}
}

func LoadRiskPolicyFromEnv() RiskPolicy {
	policy := DefaultRiskPolicy()
	if ports := parsePortSet(os.Getenv("QUICKVPS_FW_HIGH_RISK_PORTS")); len(ports) > 0 {
		policy.HighRiskPorts = ports
	}
	if ports := parsePortSet(os.Getenv("QUICKVPS_FW_MEDIUM_RISK_PORTS")); len(ports) > 0 {
		policy.MediumRiskPorts = ports
	}
	return policy
}

func parsePortSet(raw string) map[int]struct{} {
	out := make(map[int]struct{})
	for _, part := range strings.Split(raw, ",") {
		clean := strings.TrimSpace(part)
		if clean == "" {
			continue
		}
		port, err := strconv.Atoi(clean)
		if err != nil || port <= 0 || port > 65535 {
			continue
		}
		out[port] = struct{}{}
	}
	return out
}
