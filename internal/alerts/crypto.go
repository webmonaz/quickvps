package alerts

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

var ErrMissingEncryptionKey = errors.New("missing QUICKVPS_ALERTS_KEY encryption key")

type Cipher struct {
	gcm cipher.AEAD
}

func NewCipherFromBase64Key(base64Key string) (*Cipher, error) {
	if base64Key == "" {
		return nil, ErrMissingEncryptionKey
	}

	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("decode alert key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("invalid alert key length: want 32 bytes, got %d", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	return &Cipher{gcm: gcm}, nil
}

func (c *Cipher) Encrypt(plaintext string) (string, error) {
	if c == nil {
		return "", ErrMissingEncryptionKey
	}
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("read nonce: %w", err)
	}
	ciphertext := c.gcm.Seal(nil, nonce, []byte(plaintext), nil)
	packed := append(nonce, ciphertext...)
	return base64.StdEncoding.EncodeToString(packed), nil
}

func (c *Cipher) Decrypt(ciphertext string) (string, error) {
	if c == nil {
		return "", ErrMissingEncryptionKey
	}
	packed, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("decode ciphertext: %w", err)
	}

	nonceSize := c.gcm.NonceSize()
	if len(packed) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce := packed[:nonceSize]
	sealed := packed[nonceSize:]
	plain, err := c.gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plain), nil
}
