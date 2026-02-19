package ports

import "testing"

func TestSplitAddressPort(t *testing.T) {
	tests := []struct {
		name      string
		raw       string
		wantAddr  string
		wantPort  int
		wantValid bool
	}{
		{name: "ipv4 listen", raw: "127.0.0.1:8080 (LISTEN)", wantAddr: "127.0.0.1", wantPort: 8080, wantValid: true},
		{name: "wildcard", raw: "*:53", wantAddr: "*", wantPort: 53, wantValid: true},
		{name: "ipv6", raw: "[::1]:443", wantAddr: "[::1]", wantPort: 443, wantValid: true},
		{name: "missing port", raw: "localhost", wantValid: false},
		{name: "invalid port", raw: "127.0.0.1:abc", wantValid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			addr, port, ok := splitAddressPort(tt.raw)
			if ok != tt.wantValid {
				t.Fatalf("splitAddressPort() ok = %v, want %v", ok, tt.wantValid)
			}
			if !tt.wantValid {
				return
			}
			if addr != tt.wantAddr || port != tt.wantPort {
				t.Fatalf("splitAddressPort() = (%q, %d), want (%q, %d)", addr, port, tt.wantAddr, tt.wantPort)
			}
		})
	}
}

func TestParseLsofOutput(t *testing.T) {
	output := "" +
		"p101\n" +
		"cnginx\n" +
		"Ptcp\n" +
		"n*:80 (LISTEN)\n" +
		"n*:80 (LISTEN)\n" + // duplicate: should be deduped
		"p202\n" +
		"cdnsmasq\n" +
		"n127.0.0.1:53\n" + // no protocol yet: defaults to TCP
		"Pudp\n" +
		"n127.0.0.1:53\n" + // same endpoint, but UDP protocol => distinct listener
		"pbad\n" +
		"cbroken\n" +
		"n*:9999\n"

	listeners := parseLsofOutput(output)
	if len(listeners) != 3 {
		t.Fatalf("parseLsofOutput() len = %d, want 3", len(listeners))
	}

	if listeners[0].PID != 101 || listeners[0].Protocol != "TCP" || listeners[0].Port != 80 {
		t.Fatalf("listener[0] = %+v, want pid=101 proto=TCP port=80", listeners[0])
	}

	if listeners[1].PID != 202 || listeners[1].Protocol != "TCP" || listeners[1].Port != 53 {
		t.Fatalf("listener[1] = %+v, want pid=202 proto=TCP port=53", listeners[1])
	}

	if listeners[2].PID != 202 || listeners[2].Protocol != "UDP" || listeners[2].Port != 53 {
		t.Fatalf("listener[2] = %+v, want pid=202 proto=UDP port=53", listeners[2])
	}
}
