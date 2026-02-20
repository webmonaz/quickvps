package firewall

import "testing"

func TestParseUFWRules(t *testing.T) {
	raw := `Status: active

To                         Action      From
--                         ------      ----
[ 1] 22/tcp                ALLOW IN    Anywhere
[ 2] 443/tcp               ALLOW IN    Anywhere
`
	rules := parseUFWRules(raw)
	if len(rules) != 2 {
		t.Fatalf("len(rules) = %d, want 2", len(rules))
	}
	if rules[0].Port != 22 || rules[0].Protocol != "tcp" {
		t.Fatalf("unexpected first rule: %+v", rules[0])
	}
}

func TestParseNFTRules(t *testing.T) {
	raw := `table inet filter {
 chain input {
  type filter hook input priority 0; policy drop;
  tcp dport 22 accept
  udp dport 53 accept
 }
}`
	rules := parseNFTRules(raw)
	if len(rules) != 2 {
		t.Fatalf("len(rules) = %d, want 2", len(rules))
	}
	if rules[1].Protocol != "udp" || rules[1].Port != 53 {
		t.Fatalf("unexpected second rule: %+v", rules[1])
	}
}

func TestParseIPTablesRules(t *testing.T) {
	raw := `-P INPUT DROP
-A INPUT -p tcp -m tcp --dport 22 -j ACCEPT
-A INPUT -p tcp -m tcp --dport 443 -j ACCEPT`
	rules := parseIPTablesRules(raw)
	if len(rules) != 2 {
		t.Fatalf("len(rules) = %d, want 2", len(rules))
	}
	if rules[0].Action != "accept" || rules[0].Port != 22 {
		t.Fatalf("unexpected first rule: %+v", rules[0])
	}
}
