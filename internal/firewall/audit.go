package firewall

import (
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"quickvps/internal/ports"
)

type Backend string

const (
	BackendNone     Backend = "none"
	BackendUFW      Backend = "ufw"
	BackendNFTables Backend = "nftables"
	BackendIPTables Backend = "iptables"
)

type Status struct {
	Backend       Backend   `json:"backend"`
	Enabled       bool      `json:"enabled"`
	DefaultPolicy string    `json:"default_policy"`
	ScannedAt     time.Time `json:"scanned_at"`
	Error         string    `json:"error,omitempty"`
}

type Rule struct {
	Backend   Backend `json:"backend"`
	Action    string  `json:"action"`
	Direction string  `json:"direction"`
	Protocol  string  `json:"protocol"`
	Port      int     `json:"port"`
	Source    string  `json:"source"`
	Raw       string  `json:"raw"`
}

type Exposure struct {
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	Address  string `json:"address"`
	PID      int    `json:"pid"`
	Process  string `json:"process"`
	Risk     string `json:"risk"`
	Reason   string `json:"reason"`
}

var lookPath = exec.LookPath
var runCommand = runOutput

func Supported() bool {
	return runtime.GOOS == "linux"
}

func DetectBackend() Backend {
	if _, err := lookPath("ufw"); err == nil {
		return BackendUFW
	}
	if _, err := lookPath("nft"); err == nil {
		return BackendNFTables
	}
	if _, err := lookPath("iptables"); err == nil {
		return BackendIPTables
	}
	return BackendNone
}

func GetStatus() Status {
	backend := DetectBackend()
	status := Status{Backend: backend, ScannedAt: time.Now().UTC()}
	if backend == BackendNone {
		status.Error = "no firewall backend found"
		return status
	}

	var (
		out string
		err error
	)
	switch backend {
	case BackendUFW:
		out, err = runCommand("ufw", "status", "verbose")
		if err == nil {
			status.Enabled, status.DefaultPolicy = parseUFWStatus(out)
		}
	case BackendNFTables:
		out, err = runCommand("nft", "list", "ruleset")
		if err == nil {
			status.Enabled, status.DefaultPolicy = parseNFTStatus(out)
		}
	case BackendIPTables:
		out, err = runCommand("iptables", "-S")
		if err == nil {
			status.Enabled, status.DefaultPolicy = parseIPTablesStatus(out)
		}
	}

	if err != nil {
		status.Error = err.Error()
	}

	return status
}

func ListRules() ([]Rule, error) {
	backend := DetectBackend()
	if backend == BackendNone {
		return nil, errors.New("no firewall backend found")
	}

	var (
		out string
		err error
	)
	switch backend {
	case BackendUFW:
		out, err = runCommand("ufw", "status", "numbered")
		if err != nil {
			return nil, err
		}
		return parseUFWRules(out), nil
	case BackendNFTables:
		out, err = runCommand("nft", "list", "ruleset")
		if err != nil {
			return nil, err
		}
		return parseNFTRules(out), nil
	case BackendIPTables:
		out, err = runCommand("iptables", "-S")
		if err != nil {
			return nil, err
		}
		return parseIPTablesRules(out), nil
	default:
		return nil, errors.New("unsupported backend")
	}
}

func ListExposures() ([]Exposure, error) {
	listeners, err := ports.ListListeners()
	if err != nil {
		return nil, err
	}

	rules, err := ListRules()
	if err != nil {
		return nil, err
	}

	allowed := make(map[string]struct{}, len(rules))
	policy := LoadRiskPolicyFromEnv()
	for _, r := range rules {
		if strings.EqualFold(r.Action, "allow") || strings.EqualFold(r.Action, "accept") {
			k := exposureKey(strings.ToUpper(r.Protocol), r.Port)
			allowed[k] = struct{}{}
		}
	}

	out := make([]Exposure, 0, len(listeners))
	for _, l := range listeners {
		key := exposureKey(strings.ToUpper(l.Protocol), l.Port)
		_, isAllowed := allowed[key]
		risk, reason := exposureRisk(l.Port, isAllowed, policy)
		out = append(out, Exposure{
			Port:     l.Port,
			Protocol: strings.ToUpper(l.Protocol),
			Address:  l.Address,
			PID:      l.PID,
			Process:  l.Process,
			Risk:     risk,
			Reason:   reason,
		})
	}
	return out, nil
}

func parseUFWStatus(raw string) (enabled bool, policy string) {
	lower := strings.ToLower(raw)
	enabled = strings.Contains(lower, "status: active")
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(clean), "default:") {
			return enabled, strings.TrimSpace(strings.TrimPrefix(clean, "Default:"))
		}
	}
	return enabled, "unknown"
}

func parseNFTStatus(raw string) (enabled bool, policy string) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false, "unknown"
	}
	enabled = true
	if strings.Contains(raw, "policy drop") {
		policy = "drop"
	} else if strings.Contains(raw, "policy accept") {
		policy = "accept"
	} else {
		policy = "custom"
	}
	return enabled, policy
}

func parseIPTablesStatus(raw string) (enabled bool, policy string) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false, "unknown"
	}
	enabled = true
	if strings.Contains(raw, "-P INPUT DROP") {
		policy = "drop"
	} else if strings.Contains(raw, "-P INPUT ACCEPT") {
		policy = "accept"
	} else {
		policy = "custom"
	}
	return enabled, policy
}

func parseUFWRules(raw string) []Rule {
	rules := make([]Rule, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" || strings.HasPrefix(clean, "Status:") || strings.HasPrefix(clean, "To") || strings.HasPrefix(clean, "--") {
			continue
		}

		parts := strings.Fields(strings.ReplaceAll(clean, "[", ""))
		if len(parts) < 4 {
			continue
		}

		port, proto := parsePortProto(parts[1])
		rules = append(rules, Rule{
			Backend:   BackendUFW,
			Action:    strings.ToLower(parts[2]),
			Direction: strings.ToLower(parts[3]),
			Protocol:  proto,
			Port:      port,
			Source:    lastField(parts),
			Raw:       clean,
		})
	}
	return rules
}

func parseNFTRules(raw string) []Rule {
	rules := make([]Rule, 0)
	re := regexp.MustCompile(`(?i)(tcp|udp)\s+dport\s+(\d+)\s+(accept|drop)`) //nolint:gocritic
	for _, line := range strings.Split(raw, "\n") {
		m := re.FindStringSubmatch(line)
		if len(m) != 4 {
			continue
		}
		port, _ := strconv.Atoi(m[2])
		rules = append(rules, Rule{
			Backend:   BackendNFTables,
			Action:    strings.ToLower(m[3]),
			Direction: "in",
			Protocol:  strings.ToLower(m[1]),
			Port:      port,
			Source:    "any",
			Raw:       strings.TrimSpace(line),
		})
	}
	return rules
}

func parseIPTablesRules(raw string) []Rule {
	rules := make([]Rule, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" || !strings.HasPrefix(clean, "-A INPUT") {
			continue
		}
		proto := parseTokenAfter(clean, "-p")
		portToken := parseTokenAfter(clean, "--dport")
		action := strings.ToLower(parseTokenAfter(clean, "-j"))
		port, _ := strconv.Atoi(portToken)
		if port <= 0 {
			continue
		}
		rules = append(rules, Rule{
			Backend:   BackendIPTables,
			Action:    action,
			Direction: "in",
			Protocol:  strings.ToLower(proto),
			Port:      port,
			Source:    "any",
			Raw:       clean,
		})
	}
	return rules
}

func parsePortProto(raw string) (int, string) {
	parts := strings.Split(strings.TrimSpace(raw), "/")
	if len(parts) != 2 {
		return 0, ""
	}
	port, _ := strconv.Atoi(parts[0])
	return port, strings.ToLower(parts[1])
}

func parseTokenAfter(raw string, flag string) string {
	parts := strings.Fields(raw)
	for i := 0; i < len(parts)-1; i++ {
		if parts[i] == flag {
			return parts[i+1]
		}
	}
	return ""
}

func lastField(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

func exposureKey(proto string, port int) string {
	return fmt.Sprintf("%s:%d", strings.ToUpper(proto), port)
}

func exposureRisk(port int, allowed bool, policy RiskPolicy) (string, string) {
	if !allowed {
		return "low", "listener exists but no matching allow rule found"
	}
	if _, ok := policy.HighRiskPorts[port]; ok {
		return "high", "database/cache port is publicly allowed"
	}
	if _, ok := policy.MediumRiskPorts[port]; ok {
		return "medium", "sensitive infrastructure port is exposed"
	}
	return "low", "allowed service port"
}

func runOutput(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s %v failed: %w (%s)", name, args, err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
