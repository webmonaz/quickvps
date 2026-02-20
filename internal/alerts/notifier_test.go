package alerts

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestNotifierRetrySuccessAfterFailures(t *testing.T) {
	n := NewNotifier()
	n.sleep = func(_ time.Duration) {}

	attempts := 0
	n.sendTelegram = func(_ context.Context, _ string, _ []string, _ string) error {
		attempts++
		if attempts < 3 {
			return errors.New("temporary telegram error")
		}
		return nil
	}

	cfg := DefaultConfig()
	cfg.EmailEnabled = false
	cfg.TelegramEnabled = true
	cfg.TelegramChatIDs = []string{"123"}
	cfg.RetryDelaysSec = []int{0, 0, 0}

	results := n.Notify(context.Background(), cfg, Secrets{TelegramBotToken: "token"}, LevelCritical, "test")
	if len(results) != 1 {
		t.Fatalf("results len = %d, want 1", len(results))
	}
	if !results[0].Success {
		t.Fatalf("telegram result should be success after retries: %+v", results[0])
	}
	if results[0].Attempts != 3 {
		t.Fatalf("attempts = %d, want 3", results[0].Attempts)
	}
}

func TestNotifierPartialFailure(t *testing.T) {
	n := NewNotifier()
	n.sleep = func(_ time.Duration) {}
	n.sendTelegram = func(_ context.Context, _ string, _ []string, _ string) error {
		return nil
	}
	n.sendEmail = func(_ string, _ string, _ []string, _ string, _ string) error {
		return errors.New("smtp down")
	}

	cfg := DefaultConfig()
	cfg.TelegramEnabled = true
	cfg.TelegramChatIDs = []string{"123"}
	cfg.EmailEnabled = true
	cfg.RecipientEmails = []string{"ops@example.com"}
	cfg.RetryDelaysSec = []int{0}

	results := n.Notify(context.Background(), cfg, Secrets{TelegramBotToken: "token", GmailAddress: "noreply@example.com", GmailAppPassword: "pass"}, LevelWarning, "test")
	if len(results) != 2 {
		t.Fatalf("results len = %d, want 2", len(results))
	}

	if !results[0].Success {
		t.Fatalf("telegram should succeed: %+v", results[0])
	}
	if results[1].Success {
		t.Fatalf("email should fail: %+v", results[1])
	}
}
