package packages

import "testing"

func TestParseNameVersionLines(t *testing.T) {
	raw := "bash\t5.2\ncoreutils\t9.5\n"
	pkgs := parseNameVersionLines(raw)
	if len(pkgs) != 2 {
		t.Fatalf("len(pkgs) = %d, want 2", len(pkgs))
	}
	if pkgs[0].Name != "bash" || pkgs[0].Version != "5.2" {
		t.Fatalf("unexpected package: %+v", pkgs[0])
	}
}

func TestParseAPTUpdates(t *testing.T) {
	raw := `Listing... Done
openssl/stable 3.0.2 amd64 [upgradable from: 3.0.1]
nginx/stable 1.26.0 amd64 [upgradable from: 1.25.4]`
	updates := parseAPTUpdates(raw)
	if len(updates) != 2 {
		t.Fatalf("len(updates) = %d, want 2", len(updates))
	}
	if updates[0].Name != "openssl" || updates[0].CurrentVersion != "3.0.1" {
		t.Fatalf("unexpected update: %+v", updates[0])
	}
}

func TestParseDNFUpdates(t *testing.T) {
	raw := `openssl.x86_64 3.0.8-1.el9 baseos
nginx.x86_64 1.24.0-2.el9 appstream`
	updates := parseDNFUpdates(raw)
	if len(updates) != 2 {
		t.Fatalf("len(updates) = %d, want 2", len(updates))
	}
	if updates[1].Name != "nginx" || updates[1].NewVersion != "1.24.0-2.el9" {
		t.Fatalf("unexpected second update: %+v", updates[1])
	}
}

func TestParsePacmanUpdates(t *testing.T) {
	raw := `glibc 2.40-4 -> 2.40-5
linux 6.12.1 -> 6.12.2`
	updates := parsePacmanUpdates(raw)
	if len(updates) != 2 {
		t.Fatalf("len(updates) = %d, want 2", len(updates))
	}
	if updates[0].CurrentVersion != "2.40-4" || updates[0].NewVersion != "2.40-5" {
		t.Fatalf("unexpected first update: %+v", updates[0])
	}
}
