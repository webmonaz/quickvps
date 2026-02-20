package packages

import (
	"errors"
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type Manager string

const (
	ManagerNone   Manager = "none"
	ManagerAPT    Manager = "apt"
	ManagerDNF    Manager = "dnf"
	ManagerYUM    Manager = "yum"
	ManagerPacman Manager = "pacman"
)

type Package struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type Update struct {
	Name           string `json:"name"`
	CurrentVersion string `json:"current_version"`
	NewVersion     string `json:"new_version"`
}

type InventoryResult struct {
	Manager   Manager   `json:"manager"`
	Total     int       `json:"total"`
	Packages  []Package `json:"packages"`
	ScannedAt time.Time `json:"scanned_at"`
	Error     string    `json:"error,omitempty"`
}

type UpdatesResult struct {
	Manager   Manager   `json:"manager"`
	Total     int       `json:"total"`
	Updates   []Update  `json:"updates"`
	ScannedAt time.Time `json:"scanned_at"`
	Error     string    `json:"error,omitempty"`
}

var lookPath = exec.LookPath
var runCommand = runOutput

func Supported() bool {
	return runtime.GOOS == "linux"
}

func DetectManager() Manager {
	if _, err := lookPath("dpkg-query"); err == nil {
		return ManagerAPT
	}
	if _, err := lookPath("dnf"); err == nil {
		return ManagerDNF
	}
	if _, err := lookPath("yum"); err == nil {
		return ManagerYUM
	}
	if _, err := lookPath("pacman"); err == nil {
		return ManagerPacman
	}
	return ManagerNone
}

func Inventory(limit int, q string) InventoryResult {
	mgr := DetectManager()
	result := InventoryResult{Manager: mgr, ScannedAt: time.Now().UTC()}
	if mgr == ManagerNone {
		result.Error = "no package manager found"
		return result
	}

	var (
		raw string
		err error
	)
	switch mgr {
	case ManagerAPT:
		raw, err = runCommand("dpkg-query", "-W", "-f=${Package}\t${Version}\n")
		if err == nil {
			result.Packages = parseNameVersionLines(raw)
		}
	case ManagerDNF, ManagerYUM:
		raw, err = runCommand("rpm", "-qa", "--qf", "%{NAME}\t%{VERSION}-%{RELEASE}\n")
		if err == nil {
			result.Packages = parseNameVersionLines(raw)
		}
	case ManagerPacman:
		raw, err = runCommand("pacman", "-Q")
		if err == nil {
			result.Packages = parsePacmanInventory(raw)
		}
	}

	if err != nil {
		result.Error = err.Error()
		return result
	}

	result.Packages = filterPackages(result.Packages, q)
	result.Total = len(result.Packages)
	if limit > 0 && limit < len(result.Packages) {
		result.Packages = result.Packages[:limit]
	}
	return result
}

func Updates() UpdatesResult {
	mgr := DetectManager()
	result := UpdatesResult{Manager: mgr, ScannedAt: time.Now().UTC()}
	if mgr == ManagerNone {
		result.Error = "no package manager found"
		return result
	}

	var (
		raw string
		err error
	)
	switch mgr {
	case ManagerAPT:
		raw, err = runCommand("apt", "list", "--upgradable")
		if err == nil {
			result.Updates = parseAPTUpdates(raw)
		}
	case ManagerDNF:
		raw, err = runCommand("dnf", "check-update")
		if err == nil {
			result.Updates = parseDNFUpdates(raw)
		}
	case ManagerYUM:
		raw, err = runCommand("yum", "check-update")
		if err == nil {
			result.Updates = parseDNFUpdates(raw)
		}
	case ManagerPacman:
		raw, err = runCommand("pacman", "-Qu")
		if err == nil {
			result.Updates = parsePacmanUpdates(raw)
		}
	}
	if err != nil {
		result.Error = err.Error()
		return result
	}

	result.Total = len(result.Updates)
	return result
}

func parseNameVersionLines(raw string) []Package {
	out := make([]Package, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" {
			continue
		}
		parts := strings.SplitN(clean, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		out = append(out, Package{Name: strings.TrimSpace(parts[0]), Version: strings.TrimSpace(parts[1])})
	}
	return out
}

func parsePacmanInventory(raw string) []Package {
	out := make([]Package, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" {
			continue
		}
		parts := strings.Fields(clean)
		if len(parts) < 2 {
			continue
		}
		out = append(out, Package{Name: parts[0], Version: parts[1]})
	}
	return out
}

func parseAPTUpdates(raw string) []Update {
	out := make([]Update, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" || strings.HasPrefix(clean, "Listing") {
			continue
		}
		parts := strings.Fields(clean)
		if len(parts) < 3 {
			continue
		}

		name := strings.SplitN(parts[0], "/", 2)[0]
		newVersion := parts[1]
		current := ""
		idx := strings.Index(clean, "[upgradable from: ")
		if idx >= 0 {
			tail := clean[idx+len("[upgradable from: "):]
			current = strings.TrimSuffix(tail, "]")
		}

		out = append(out, Update{Name: name, CurrentVersion: current, NewVersion: newVersion})
	}
	return out
}

func parseDNFUpdates(raw string) []Update {
	out := make([]Update, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" || strings.HasPrefix(clean, "Last metadata expiration") || strings.HasPrefix(clean, "Obsoleting") {
			continue
		}
		parts := strings.Fields(clean)
		if len(parts) < 3 {
			continue
		}
		name := strings.SplitN(parts[0], ".", 2)[0]
		out = append(out, Update{Name: name, NewVersion: parts[1]})
	}
	return out
}

func parsePacmanUpdates(raw string) []Update {
	out := make([]Update, 0)
	for _, line := range strings.Split(raw, "\n") {
		clean := strings.TrimSpace(line)
		if clean == "" {
			continue
		}
		parts := strings.Fields(clean)
		if len(parts) < 4 {
			continue
		}
		if parts[2] != "->" {
			continue
		}
		out = append(out, Update{
			Name:           parts[0],
			CurrentVersion: parts[1],
			NewVersion:     parts[3],
		})
	}
	return out
}

func filterPackages(all []Package, q string) []Package {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return all
	}
	out := make([]Package, 0, len(all))
	for _, p := range all {
		if strings.Contains(strings.ToLower(p.Name), q) || strings.Contains(strings.ToLower(p.Version), q) {
			out = append(out, p)
		}
	}
	return out
}

func ParseLimit(raw string, defaultLimit int) int {
	if defaultLimit <= 0 {
		defaultLimit = 100
	}
	if strings.TrimSpace(raw) == "" {
		return defaultLimit
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return defaultLimit
	}
	if n > 1000 {
		return 1000
	}
	return n
}

func runOutput(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s %v failed: %w (%s)", name, args, err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func ValidateManagers() error {
	if DetectManager() == ManagerNone {
		return errors.New("no package manager found")
	}
	return nil
}
