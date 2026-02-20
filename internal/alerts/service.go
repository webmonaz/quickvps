package alerts

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"quickvps/internal/metrics"
)

var ErrServiceNotConfigured = errors.New("alert service is not configured")

type Service struct {
	mu              sync.RWMutex
	store           *Store
	notifier        *Notifier
	cipher          *Cipher
	secretsWritable bool
	hostname        string

	cfg       Config
	secrets   Secrets
	secretRec secretRecord
	status    Status

	evaluator      *Evaluator
	historyDays    int
	cleanupEvery   time.Duration
	lastCleanupRun time.Time
}

func NewService(store *Store, notifier *Notifier, base64Key string) (*Service, error) {
	if store == nil {
		return nil, ErrServiceNotConfigured
	}
	if notifier == nil {
		notifier = NewNotifier()
	}

	cfg, err := store.LoadConfig()
	if err != nil {
		return nil, err
	}

	rec, err := store.LoadSecretRecord()
	if err != nil {
		return nil, err
	}

	var (
		c               *Cipher
		secretsWritable bool
		secrets         Secrets
	)
	if base64Key != "" {
		parsed, err := NewCipherFromBase64Key(base64Key)
		if err != nil {
			return nil, err
		}
		c = parsed
		secretsWritable = true

		if rec.TelegramTokenCipher != "" {
			plain, err := c.Decrypt(rec.TelegramTokenCipher)
			if err == nil {
				secrets.TelegramBotToken = plain
			}
		}
		if rec.GmailPasswordCipher != "" {
			plain, err := c.Decrypt(rec.GmailPasswordCipher)
			if err == nil {
				secrets.GmailAppPassword = plain
			}
		}
	}
	secrets.GmailAddress = rec.GmailAddress

	mutedUntil, err := store.GetMutedUntil()
	if err != nil {
		return nil, err
	}

	hostname, _ := os.Hostname()
	if strings.TrimSpace(hostname) == "" {
		hostname = "unknown-host"
	}

	s := &Service{
		store:           store,
		notifier:        notifier,
		cipher:          c,
		secretsWritable: secretsWritable,
		hostname:        hostname,
		cfg:             cfg,
		secrets:         secrets,
		secretRec:       rec,
		status: Status{
			CurrentState: LevelNone,
			MutedUntil:   mutedUntil,
			Silenced:     isSilencedAt(mutedUntil, time.Now()),
		},
		evaluator:    NewEvaluator(),
		historyDays:  DefaultHistoryRetentionDays,
		cleanupEvery: time.Hour,
	}
	return s, nil
}

func (s *Service) Run(ctx context.Context, sub <-chan *metrics.Snapshot) {
	if sub == nil {
		return
	}
	cleanupTicker := time.NewTicker(s.cleanupEvery)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-cleanupTicker.C:
			s.cleanupOldEvents()
		case snap, ok := <-sub:
			if !ok {
				return
			}
			if snap == nil {
				continue
			}
			s.EvaluateSnapshot(ctx, snap)
		}
	}
}

func (s *Service) EvaluateSnapshot(ctx context.Context, snap *metrics.Snapshot) {
	now := snap.Timestamp
	cpuPercent := snap.CPU.TotalPercent

	s.mu.Lock()
	cfg := s.cfg
	secrets := s.secrets
	mutedUntil := s.status.MutedUntil
	s.status.LastEvaluatedAt = now
	s.status.LastCPUPercent = cpuPercent
	s.status.Silenced = isSilencedAt(mutedUntil, now)

	triggers := s.evaluator.Evaluate(now, cpuPercent, cfg, s.status.Silenced)
	s.status.CurrentState = s.evaluator.State()
	s.status.LastWarningAt = s.evaluator.LastWarningAt()
	s.status.LastCriticalAt = s.evaluator.LastCriticalAt()
	s.status.LastRecoveryAt = s.evaluator.LastRecoveryAt()
	s.mu.Unlock()

	for _, trigger := range triggers {
		s.dispatch(ctx, trigger.Level, trigger.CPUPercent, cfg, secrets, now)
	}
}

func (s *Service) dispatch(ctx context.Context, level Level, cpuPercent float64, cfg Config, secrets Secrets, now time.Time) {
	message := formatAlertMessage(level, s.hostname, cpuPercent, now)
	results := s.notifier.Notify(ctx, cfg, secrets, level, message)
	id, err := s.store.SaveEvent(level, message, cpuPercent, results, now)
	if err == nil {
		_ = id
	}
}

func (s *Service) TriggerTest(ctx context.Context) (Event, error) {
	s.mu.RLock()
	cfg := s.cfg
	secrets := s.secrets
	hostname := s.hostname
	s.mu.RUnlock()

	if !cfg.TelegramEnabled && !cfg.EmailEnabled {
		return Event{}, errors.New("both channels are disabled")
	}

	now := time.Now().UTC()
	msg := fmt.Sprintf("[QuickVPS][TEST] Host=%s Time=%s", hostname, now.Format(time.RFC3339))
	results := s.notifier.Notify(ctx, cfg, secrets, LevelTest, msg)
	id, err := s.store.SaveEvent(LevelTest, msg, 0, results, now)
	if err != nil {
		return Event{}, err
	}
	return Event{
		ID:         id,
		Level:      LevelTest,
		Message:    msg,
		CPUPercent: 0,
		Channels:   results,
		CreatedAt:  now,
	}, nil
}

func (s *Service) ConfigView(readOnly bool) ConfigView {
	s.mu.RLock()
	defer s.mu.RUnlock()

	view := ConfigView{
		Config:            s.cfg,
		HasTelegramToken:  strings.TrimSpace(s.secretRec.TelegramTokenCipher) != "",
		TelegramTokenMask: maskSecret(s.secrets.TelegramBotToken, strings.TrimSpace(s.secretRec.TelegramTokenCipher) != ""),
		HasGmailPassword:  strings.TrimSpace(s.secretRec.GmailPasswordCipher) != "",
		GmailPasswordMask: maskSecret(s.secrets.GmailAppPassword, strings.TrimSpace(s.secretRec.GmailPasswordCipher) != ""),
		GmailAddress:      strings.TrimSpace(s.secretRec.GmailAddress),
		SecretsWritable:   s.secretsWritable,
		ReadOnly:          readOnly,
	}
	return view
}

func (s *Service) UpdateConfig(in UpdateConfigInput) (ConfigView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg := s.cfg
	secrets := s.secrets
	rec := s.secretRec

	if in.Enabled != nil {
		cfg.Enabled = *in.Enabled
	}
	if in.WarningPercent != nil {
		cfg.WarningPercent = *in.WarningPercent
	}
	if in.WarningForSec != nil {
		cfg.WarningForSec = *in.WarningForSec
	}
	if in.CriticalPercent != nil {
		cfg.CriticalPercent = *in.CriticalPercent
	}
	if in.CriticalForSec != nil {
		cfg.CriticalForSec = *in.CriticalForSec
	}
	if in.RecoveryPercent != nil {
		cfg.RecoveryPercent = *in.RecoveryPercent
	}
	if in.RecoveryForSec != nil {
		cfg.RecoveryForSec = *in.RecoveryForSec
	}
	if in.CooldownSec != nil {
		cfg.CooldownSec = *in.CooldownSec
	}
	if in.TelegramEnabled != nil {
		cfg.TelegramEnabled = *in.TelegramEnabled
	}
	if in.EmailEnabled != nil {
		cfg.EmailEnabled = *in.EmailEnabled
	}
	if in.RecipientEmails != nil {
		cfg.RecipientEmails = sanitizeStringSlice(in.RecipientEmails)
	}
	if in.TelegramChatIDs != nil {
		cfg.TelegramChatIDs = sanitizeStringSlice(in.TelegramChatIDs)
	}
	if in.RetryDelaysSec != nil {
		cfg.RetryDelaysSec = sanitizeRetryDelays(in.RetryDelaysSec)
	}

	if err := validateConfig(cfg); err != nil {
		return ConfigView{}, err
	}

	if strings.TrimSpace(in.TelegramBotToken) != "" {
		if !s.secretsWritable {
			return ConfigView{}, ErrMissingEncryptionKey
		}
		cipher, err := s.cipher.Encrypt(strings.TrimSpace(in.TelegramBotToken))
		if err != nil {
			return ConfigView{}, err
		}
		rec.TelegramTokenCipher = cipher
		secrets.TelegramBotToken = strings.TrimSpace(in.TelegramBotToken)
	}
	if in.ClearTelegramBotToken {
		rec.TelegramTokenCipher = ""
		secrets.TelegramBotToken = ""
	}

	if strings.TrimSpace(in.GmailAddress) != "" {
		rec.GmailAddress = strings.TrimSpace(in.GmailAddress)
		secrets.GmailAddress = rec.GmailAddress
	}

	if strings.TrimSpace(in.GmailAppPassword) != "" {
		if !s.secretsWritable {
			return ConfigView{}, ErrMissingEncryptionKey
		}
		cipher, err := s.cipher.Encrypt(strings.TrimSpace(in.GmailAppPassword))
		if err != nil {
			return ConfigView{}, err
		}
		rec.GmailPasswordCipher = cipher
		secrets.GmailAppPassword = strings.TrimSpace(in.GmailAppPassword)
	}
	if in.ClearGmailAppPassword {
		rec.GmailPasswordCipher = ""
		secrets.GmailAppPassword = ""
	}

	if err := s.store.SaveConfig(cfg); err != nil {
		return ConfigView{}, err
	}
	if err := s.store.SaveSecretRecord(rec); err != nil {
		return ConfigView{}, err
	}

	s.cfg = cfg
	s.secrets = secrets
	s.secretRec = rec

	return ConfigView{
		Config:            cfg,
		HasTelegramToken:  rec.TelegramTokenCipher != "",
		TelegramTokenMask: maskSecret(secrets.TelegramBotToken, rec.TelegramTokenCipher != ""),
		HasGmailPassword:  rec.GmailPasswordCipher != "",
		GmailPasswordMask: maskSecret(secrets.GmailAppPassword, rec.GmailPasswordCipher != ""),
		GmailAddress:      rec.GmailAddress,
		SecretsWritable:   s.secretsWritable,
		ReadOnly:          false,
	}, nil
}

func (s *Service) Status(readOnly bool) Status {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.status
	out.ReadOnly = readOnly
	out.Silenced = isSilencedAt(s.status.MutedUntil, time.Now())
	return out
}

func (s *Service) SetSilence(minutes int) (*time.Time, error) {
	if minutes <= 0 || minutes > 1440 {
		return nil, errors.New("minutes must be between 1 and 1440")
	}
	until := time.Now().UTC().Add(time.Duration(minutes) * time.Minute)
	if err := s.store.SetMutedUntil(&until); err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.status.MutedUntil = &until
	s.status.Silenced = true
	s.mu.Unlock()
	return &until, nil
}

func (s *Service) ClearSilence() error {
	if err := s.store.SetMutedUntil(nil); err != nil {
		return err
	}
	s.mu.Lock()
	s.status.MutedUntil = nil
	s.status.Silenced = false
	s.mu.Unlock()
	return nil
}

func (s *Service) ListHistory(limit int, beforeID int64) ([]Event, error) {
	return s.store.ListEvents(limit, beforeID)
}

func (s *Service) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg.Enabled
}

func (s *Service) SecretsWritable() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.secretsWritable
}

func (s *Service) HistoryRetentionDays() int {
	return s.historyDays
}

func (s *Service) cleanupOldEvents() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Since(s.lastCleanupRun) < s.cleanupEvery {
		return
	}
	s.lastCleanupRun = time.Now()
	_ = s.store.CleanupEvents(s.historyDays)
}

func formatAlertMessage(level Level, hostname string, cpuPercent float64, now time.Time) string {
	return fmt.Sprintf(
		"[QuickVPS][%s] Host=%s CPU=%.2f%% Time=%s",
		strings.ToUpper(string(level)),
		hostname,
		cpuPercent,
		now.UTC().Format(time.RFC3339),
	)
}

func validateConfig(cfg Config) error {
	if cfg.WarningPercent <= 0 || cfg.WarningPercent > 100 {
		return errors.New("warning_percent must be > 0 and <= 100")
	}
	if cfg.CriticalPercent <= 0 || cfg.CriticalPercent > 100 {
		return errors.New("critical_percent must be > 0 and <= 100")
	}
	if cfg.RecoveryPercent < 0 || cfg.RecoveryPercent > 100 {
		return errors.New("recovery_percent must be >= 0 and <= 100")
	}
	if cfg.WarningPercent >= cfg.CriticalPercent {
		return errors.New("warning_percent must be lower than critical_percent")
	}
	if cfg.RecoveryPercent >= cfg.WarningPercent {
		return errors.New("recovery_percent must be lower than warning_percent")
	}
	if cfg.WarningForSec <= 0 || cfg.CriticalForSec <= 0 || cfg.RecoveryForSec <= 0 {
		return errors.New("window seconds must be > 0")
	}
	if cfg.CooldownSec < 0 {
		return errors.New("cooldown_sec must be >= 0")
	}
	return nil
}

func sanitizeStringSlice(items []string) []string {
	if items == nil {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, raw := range items {
		clean := strings.TrimSpace(raw)
		if clean != "" {
			out = append(out, clean)
		}
	}
	return out
}

func sanitizeRetryDelays(items []int) []int {
	if items == nil {
		return nil
	}
	out := make([]int, 0, len(items))
	for _, d := range items {
		if d < 0 {
			continue
		}
		out = append(out, d)
	}
	if len(out) == 0 {
		out = []int{1, 5, 15}
	}
	return out
}

func isSilencedAt(mutedUntil *time.Time, now time.Time) bool {
	if mutedUntil == nil {
		return false
	}
	return mutedUntil.After(now)
}

func maskSecret(secret string, present bool) string {
	if !present {
		return ""
	}
	trimmed := strings.TrimSpace(secret)
	if trimmed == "" {
		return "********"
	}
	if len(trimmed) <= 4 {
		return "****"
	}
	return "****" + trimmed[len(trimmed)-4:]
}
