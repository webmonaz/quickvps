package ports

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"syscall"
)

var ErrNoProcessOnPort = errors.New("no process found on port")

type Listener struct {
	Protocol string `json:"protocol"`
	Address  string `json:"address"`
	Port     int    `json:"port"`
	PID      int    `json:"pid"`
	Process  string `json:"process"`
}

func ListListeners() ([]Listener, error) {
	tcp, err := runLsof("-nP", "-iTCP", "-sTCP:LISTEN", "-FpcPn")
	if err != nil {
		return nil, err
	}

	udp, err := runLsof("-nP", "-iUDP", "-FpcPn")
	if err != nil {
		return nil, err
	}

	listeners := append(tcp, udp...)
	sort.Slice(listeners, func(i, j int) bool {
		if listeners[i].Port != listeners[j].Port {
			return listeners[i].Port < listeners[j].Port
		}
		if listeners[i].Protocol != listeners[j].Protocol {
			return listeners[i].Protocol < listeners[j].Protocol
		}
		return listeners[i].PID < listeners[j].PID
	})
	return listeners, nil
}

func KillByPort(port int) ([]int, error) {
	listeners, err := ListListeners()
	if err != nil {
		return nil, err
	}

	pids := make(map[int]struct{})
	for _, l := range listeners {
		if l.Port == port {
			pids[l.PID] = struct{}{}
		}
	}

	if len(pids) == 0 {
		return nil, ErrNoProcessOnPort
	}

	ordered := make([]int, 0, len(pids))
	for pid := range pids {
		ordered = append(ordered, pid)
	}
	sort.Ints(ordered)

	var failed []string
	killed := make([]int, 0, len(ordered))
	for _, pid := range ordered {
		proc, findErr := os.FindProcess(pid)
		if findErr != nil {
			failed = append(failed, fmt.Sprintf("pid %d: %v", pid, findErr))
			continue
		}
		if signalErr := proc.Signal(syscall.SIGTERM); signalErr != nil {
			failed = append(failed, fmt.Sprintf("pid %d: %v", pid, signalErr))
			continue
		}
		killed = append(killed, pid)
	}

	if len(failed) > 0 {
		return killed, fmt.Errorf("failed to kill some processes: %s", strings.Join(failed, "; "))
	}

	return killed, nil
}

func runLsof(args ...string) ([]Listener, error) {
	cmd := exec.Command("lsof", args...)
	out, err := cmd.Output()
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, errors.New("lsof command not found")
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			if len(exitErr.Stderr) == 0 {
				return []Listener{}, nil
			}
			return nil, fmt.Errorf("lsof failed: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, err
	}
	return parseLsofOutput(string(out)), nil
}

func parseLsofOutput(output string) []Listener {
	lines := strings.Split(output, "\n")

	currentPID := 0
	currentProcess := ""
	currentProto := ""

	seen := make(map[string]struct{})
	listeners := make([]Listener, 0)

	for _, line := range lines {
		if len(line) < 2 {
			continue
		}

		key := line[0]
		value := line[1:]

		switch key {
		case 'p':
			pid, err := strconv.Atoi(value)
			if err != nil {
				currentPID = 0
				continue
			}
			currentPID = pid
		case 'c':
			currentProcess = value
		case 'P':
			currentProto = strings.ToUpper(value)
		case 'n':
			address, port, ok := splitAddressPort(value)
			if !ok || currentPID <= 0 || port <= 0 {
				continue
			}
			proto := currentProto
			if proto == "" {
				proto = "TCP"
			}

			dedupe := fmt.Sprintf("%s:%s:%d:%d", proto, address, port, currentPID)
			if _, exists := seen[dedupe]; exists {
				continue
			}
			seen[dedupe] = struct{}{}

			listeners = append(listeners, Listener{
				Protocol: proto,
				Address:  address,
				Port:     port,
				PID:      currentPID,
				Process:  currentProcess,
			})
		}
	}

	return listeners
}

func splitAddressPort(raw string) (string, int, bool) {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimSuffix(cleaned, " (LISTEN)")

	idx := strings.LastIndex(cleaned, ":")
	if idx <= 0 || idx >= len(cleaned)-1 {
		return "", 0, false
	}

	address := cleaned[:idx]
	portStr := cleaned[idx+1:]

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return "", 0, false
	}

	return address, port, true
}
