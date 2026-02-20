package alerts

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestCipherEncryptDecrypt(t *testing.T) {
	key := strings.Repeat("k", 32)
	encoded := base64.StdEncoding.EncodeToString([]byte(key))

	c, err := NewCipherFromBase64Key(encoded)
	if err != nil {
		t.Fatalf("NewCipherFromBase64Key() error = %v", err)
	}

	ciphertext, err := c.Encrypt("super-secret")
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}
	if ciphertext == "" {
		t.Fatalf("Encrypt() returned empty ciphertext")
	}

	plaintext, err := c.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}
	if plaintext != "super-secret" {
		t.Fatalf("Decrypt() = %q, want %q", plaintext, "super-secret")
	}
}

func TestCipherInvalidKey(t *testing.T) {
	_, err := NewCipherFromBase64Key("")
	if err == nil {
		t.Fatalf("expected error for empty key")
	}

	_, err = NewCipherFromBase64Key(base64.StdEncoding.EncodeToString([]byte("short")))
	if err == nil {
		t.Fatalf("expected error for short key")
	}
}
