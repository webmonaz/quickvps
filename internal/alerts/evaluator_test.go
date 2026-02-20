package alerts

import (
	"testing"
	"time"
)

func TestEvaluatorCriticalCooldownAndRecovery(t *testing.T) {
	cfg := DefaultConfig()
	e := NewEvaluator()
	base := time.Date(2026, 2, 20, 10, 0, 0, 0, time.UTC)

	if got := e.Evaluate(base, 90, cfg, false); len(got) != 0 {
		t.Fatalf("unexpected trigger at t0: %+v", got)
	}

	firstCriticalAt := base.Add(10 * time.Minute)
	got := e.Evaluate(firstCriticalAt, 90, cfg, false)
	if len(got) != 1 || got[0].Level != LevelCritical {
		t.Fatalf("expected critical trigger at 10m, got %+v", got)
	}

	if got := e.Evaluate(firstCriticalAt.Add(1*time.Minute), 90, cfg, false); len(got) != 0 {
		t.Fatalf("unexpected trigger during cooldown: %+v", got)
	}

	realertAt := firstCriticalAt.Add(30 * time.Minute)
	got = e.Evaluate(realertAt, 90, cfg, false)
	if len(got) != 1 || got[0].Level != LevelCritical {
		t.Fatalf("expected critical re-alert after cooldown, got %+v", got)
	}

	belowStart := realertAt.Add(time.Minute)
	if got := e.Evaluate(belowStart, 60, cfg, false); len(got) != 0 {
		t.Fatalf("unexpected recovery trigger at recovery window start: %+v", got)
	}

	recoveryAt := belowStart.Add(5 * time.Minute)
	got = e.Evaluate(recoveryAt, 60, cfg, false)
	if len(got) != 1 || got[0].Level != LevelRecovery {
		t.Fatalf("expected recovery trigger at 5m below recovery threshold, got %+v", got)
	}
}

func TestEvaluatorSilencedSuppressesNotifications(t *testing.T) {
	cfg := DefaultConfig()
	e := NewEvaluator()
	base := time.Date(2026, 2, 20, 11, 0, 0, 0, time.UTC)

	_ = e.Evaluate(base, 90, cfg, true)
	got := e.Evaluate(base.Add(10*time.Minute), 90, cfg, true)
	if len(got) != 0 {
		t.Fatalf("expected no trigger while silenced, got %+v", got)
	}

	if e.State() != LevelCritical {
		t.Fatalf("expected evaluator state to become critical while silenced, got %q", e.State())
	}
}
