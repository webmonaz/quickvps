package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

type telegramSendFunc func(ctx context.Context, token string, chatIDs []string, text string) error

type emailSendFunc func(from string, appPassword string, to []string, subject string, body string) error

type Notifier struct {
	httpClient   *http.Client
	sleep        func(time.Duration)
	sendTelegram telegramSendFunc
	sendEmail    emailSendFunc
}

func NewNotifier() *Notifier {
	n := &Notifier{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		sleep:      time.Sleep,
	}
	n.sendTelegram = n.sendTelegramDefault
	n.sendEmail = sendEmailDefault
	return n
}

func (n *Notifier) Notify(ctx context.Context, cfg Config, secrets Secrets, level Level, message string) []ChannelResult {
	results := make([]ChannelResult, 0, 2)

	delays := cfg.RetryDelaysSec
	if len(delays) == 0 {
		delays = []int{1, 5, 15}
	}

	if cfg.TelegramEnabled {
		res := ChannelResult{Channel: "telegram"}
		err := n.retry(ctx, delays, func() error {
			return n.sendTelegram(ctx, strings.TrimSpace(secrets.TelegramBotToken), cfg.TelegramChatIDs, message)
		}, &res)
		if err != nil {
			res.Success = false
			res.ErrorMessage = err.Error()
		} else {
			res.Success = true
		}
		results = append(results, res)
	}

	if cfg.EmailEnabled {
		res := ChannelResult{Channel: "email"}
		err := n.retry(ctx, delays, func() error {
			return n.sendEmail(
				strings.TrimSpace(secrets.GmailAddress),
				strings.TrimSpace(secrets.GmailAppPassword),
				cfg.RecipientEmails,
				fmt.Sprintf("[QuickVPS] CPU %s", strings.ToUpper(string(level))),
				message,
			)
		}, &res)
		if err != nil {
			res.Success = false
			res.ErrorMessage = err.Error()
		} else {
			res.Success = true
		}
		results = append(results, res)
	}

	return results
}

func (n *Notifier) retry(ctx context.Context, delays []int, fn func() error, res *ChannelResult) error {
	if res == nil {
		return errors.New("nil channel result")
	}

	attempts := len(delays)
	if attempts == 0 {
		attempts = 1
		delays = []int{0}
	}

	var lastErr error
	for i := 0; i < attempts; i++ {
		res.Attempts++
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
		}

		if i == attempts-1 {
			break
		}

		sleepFor := time.Duration(delays[i]) * time.Second
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			n.sleep(sleepFor)
		}
	}

	if lastErr == nil {
		return errors.New("notification failed")
	}
	return lastErr
}

func (n *Notifier) sendTelegramDefault(ctx context.Context, token string, chatIDs []string, text string) error {
	if token == "" {
		return errors.New("telegram token is empty")
	}
	if len(chatIDs) == 0 {
		return errors.New("telegram chat_ids is empty")
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	for _, rawChatID := range chatIDs {
		chatID := strings.TrimSpace(rawChatID)
		if chatID == "" {
			continue
		}

		payload := map[string]string{
			"chat_id": chatID,
			"text":    text,
		}
		body, _ := json.Marshal(payload)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := n.httpClient.Do(req)
		if err != nil {
			return err
		}
		_ = resp.Body.Close()
		if resp.StatusCode >= 300 {
			return fmt.Errorf("telegram send failed with status %d", resp.StatusCode)
		}
	}

	return nil
}

func sendEmailDefault(from string, appPassword string, to []string, subject string, body string) error {
	from = strings.TrimSpace(from)
	appPassword = strings.TrimSpace(appPassword)
	if from == "" {
		return errors.New("gmail_address is empty")
	}
	if appPassword == "" {
		return errors.New("gmail_app_password is empty")
	}

	recipients := make([]string, 0, len(to))
	for _, raw := range to {
		email := strings.TrimSpace(raw)
		if email != "" {
			recipients = append(recipients, email)
		}
	}
	if len(recipients) == 0 {
		return errors.New("recipient_emails is empty")
	}

	host := "smtp.gmail.com"
	addr := host + ":587"
	auth := smtp.PlainAuth("", from, appPassword, host)

	msg := bytes.Buffer{}
	msg.WriteString("From: " + from + "\r\n")
	msg.WriteString("To: " + strings.Join(recipients, ",") + "\r\n")
	msg.WriteString("Subject: " + subject + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(body)

	if err := smtp.SendMail(addr, auth, from, recipients, msg.Bytes()); err != nil {
		return fmt.Errorf("send gmail smtp: %w", err)
	}
	return nil
}
