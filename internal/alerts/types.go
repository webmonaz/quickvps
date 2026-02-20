package alerts

import "time"

type Level string

const (
	LevelNone     Level = "none"
	LevelWarning  Level = "warning"
	LevelCritical Level = "critical"
	LevelRecovery Level = "recovery"
	LevelTest     Level = "test"
)

type Config struct {
	Enabled         bool     `json:"enabled"`
	WarningPercent  float64  `json:"warning_percent"`
	WarningForSec   int64    `json:"warning_for_sec"`
	CriticalPercent float64  `json:"critical_percent"`
	CriticalForSec  int64    `json:"critical_for_sec"`
	RecoveryPercent float64  `json:"recovery_percent"`
	RecoveryForSec  int64    `json:"recovery_for_sec"`
	CooldownSec     int64    `json:"cooldown_sec"`
	TelegramEnabled bool     `json:"telegram_enabled"`
	EmailEnabled    bool     `json:"email_enabled"`
	RecipientEmails []string `json:"recipient_emails"`
	TelegramChatIDs []string `json:"telegram_chat_ids"`
	RetryDelaysSec  []int    `json:"retry_delays_sec"`
}

type Secrets struct {
	TelegramBotToken string `json:"telegram_bot_token,omitempty"`
	GmailAddress     string `json:"gmail_address,omitempty"`
	GmailAppPassword string `json:"gmail_app_password,omitempty"`
}

type ConfigView struct {
	Config
	HasTelegramToken  bool   `json:"has_telegram_token"`
	TelegramTokenMask string `json:"telegram_token_mask"`
	HasGmailPassword  bool   `json:"has_gmail_password"`
	GmailPasswordMask string `json:"gmail_password_mask"`
	GmailAddress      string `json:"gmail_address"`
	SecretsWritable   bool   `json:"secrets_writable"`
	ReadOnly          bool   `json:"read_only"`
}

type UpdateConfigInput struct {
	Enabled         *bool    `json:"enabled"`
	WarningPercent  *float64 `json:"warning_percent"`
	WarningForSec   *int64   `json:"warning_for_sec"`
	CriticalPercent *float64 `json:"critical_percent"`
	CriticalForSec  *int64   `json:"critical_for_sec"`
	RecoveryPercent *float64 `json:"recovery_percent"`
	RecoveryForSec  *int64   `json:"recovery_for_sec"`
	CooldownSec     *int64   `json:"cooldown_sec"`

	TelegramEnabled *bool    `json:"telegram_enabled"`
	EmailEnabled    *bool    `json:"email_enabled"`
	RecipientEmails []string `json:"recipient_emails"`
	TelegramChatIDs []string `json:"telegram_chat_ids"`
	RetryDelaysSec  []int    `json:"retry_delays_sec"`

	TelegramBotToken      string `json:"telegram_bot_token"`
	ClearTelegramBotToken bool   `json:"clear_telegram_bot_token"`
	GmailAddress          string `json:"gmail_address"`
	GmailAppPassword      string `json:"gmail_app_password"`
	ClearGmailAppPassword bool   `json:"clear_gmail_app_password"`
}

type Status struct {
	CurrentState    Level      `json:"current_state"`
	LastCPUPercent  float64    `json:"last_cpu_percent"`
	LastEvaluatedAt time.Time  `json:"last_evaluated_at"`
	MutedUntil      *time.Time `json:"muted_until,omitempty"`
	Silenced        bool       `json:"silenced"`
	LastWarningAt   *time.Time `json:"last_warning_at,omitempty"`
	LastCriticalAt  *time.Time `json:"last_critical_at,omitempty"`
	LastRecoveryAt  *time.Time `json:"last_recovery_at,omitempty"`
	ReadOnly        bool       `json:"read_only"`
}

type ChannelResult struct {
	Channel      string `json:"channel"`
	Success      bool   `json:"success"`
	Attempts     int    `json:"attempts"`
	ErrorMessage string `json:"error_message,omitempty"`
}

type Event struct {
	ID         int64           `json:"id"`
	Level      Level           `json:"level"`
	Message    string          `json:"message"`
	CPUPercent float64         `json:"cpu_percent"`
	Channels   []ChannelResult `json:"channels"`
	CreatedAt  time.Time       `json:"created_at"`
}

const DefaultHistoryRetentionDays = 30

func DefaultConfig() Config {
	return Config{
		Enabled:         true,
		WarningPercent:  75,
		WarningForSec:   300,
		CriticalPercent: 85,
		CriticalForSec:  600,
		RecoveryPercent: 70,
		RecoveryForSec:  300,
		CooldownSec:     1800,
		TelegramEnabled: true,
		EmailEnabled:    true,
		RetryDelaysSec:  []int{1, 5, 15},
	}
}
