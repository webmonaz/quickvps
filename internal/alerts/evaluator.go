package alerts

import "time"

type Trigger struct {
	Level      Level
	CPUPercent float64
}

type Evaluator struct {
	activeLevel        Level
	aboveWarningSince  *time.Time
	aboveCriticalSince *time.Time
	belowRecoverySince *time.Time
	lastSent           map[Level]time.Time
	lastWarningAt      *time.Time
	lastCriticalAt     *time.Time
	lastRecoveryAt     *time.Time
}

func NewEvaluator() *Evaluator {
	return &Evaluator{
		activeLevel: LevelNone,
		lastSent:    make(map[Level]time.Time, 3),
	}
}

func (e *Evaluator) State() Level {
	return e.activeLevel
}

func (e *Evaluator) LastWarningAt() *time.Time {
	return e.lastWarningAt
}

func (e *Evaluator) LastCriticalAt() *time.Time {
	return e.lastCriticalAt
}

func (e *Evaluator) LastRecoveryAt() *time.Time {
	return e.lastRecoveryAt
}

func (e *Evaluator) Evaluate(now time.Time, cpuPercent float64, cfg Config, silenced bool) []Trigger {
	if !cfg.Enabled {
		e.resetWindows()
		e.activeLevel = LevelNone
		return nil
	}

	if cpuPercent >= cfg.CriticalPercent {
		e.belowRecoverySince = nil
		if e.aboveWarningSince == nil {
			t := now
			e.aboveWarningSince = &t
		}
		if e.aboveCriticalSince == nil {
			t := now
			e.aboveCriticalSince = &t
		}

		if e.windowElapsed(e.aboveCriticalSince, now, cfg.CriticalForSec) && e.canSend(LevelCritical, now, cfg.CooldownSec) {
			if !silenced {
				e.markSent(LevelCritical, now)
				e.activeLevel = LevelCritical
				return []Trigger{{Level: LevelCritical, CPUPercent: cpuPercent}}
			}
			e.activeLevel = LevelCritical
		}

		return nil
	}
	e.aboveCriticalSince = nil

	if cpuPercent >= cfg.WarningPercent {
		e.belowRecoverySince = nil
		if e.aboveWarningSince == nil {
			t := now
			e.aboveWarningSince = &t
		}

		if e.windowElapsed(e.aboveWarningSince, now, cfg.WarningForSec) && e.canSend(LevelWarning, now, cfg.CooldownSec) {
			if !silenced {
				e.markSent(LevelWarning, now)
				if e.activeLevel != LevelCritical {
					e.activeLevel = LevelWarning
				}
				return []Trigger{{Level: LevelWarning, CPUPercent: cpuPercent}}
			}
			if e.activeLevel == LevelNone {
				e.activeLevel = LevelWarning
			}
		}

		return nil
	}
	e.aboveWarningSince = nil

	if e.activeLevel != LevelNone && cpuPercent < cfg.RecoveryPercent {
		if e.belowRecoverySince == nil {
			t := now
			e.belowRecoverySince = &t
		}

		if e.windowElapsed(e.belowRecoverySince, now, cfg.RecoveryForSec) && e.canSend(LevelRecovery, now, cfg.CooldownSec) {
			if !silenced {
				e.markSent(LevelRecovery, now)
				e.activeLevel = LevelNone
				e.resetWindows()
				return []Trigger{{Level: LevelRecovery, CPUPercent: cpuPercent}}
			}
			e.activeLevel = LevelNone
			e.resetWindows()
		}
	} else {
		e.belowRecoverySince = nil
	}

	return nil
}

func (e *Evaluator) resetWindows() {
	e.aboveWarningSince = nil
	e.aboveCriticalSince = nil
	e.belowRecoverySince = nil
}

func (e *Evaluator) windowElapsed(since *time.Time, now time.Time, requiredSec int64) bool {
	if since == nil {
		return false
	}
	if requiredSec <= 0 {
		return true
	}
	return now.Sub(*since) >= time.Duration(requiredSec)*time.Second
}

func (e *Evaluator) canSend(level Level, now time.Time, cooldownSec int64) bool {
	last, ok := e.lastSent[level]
	if !ok {
		return true
	}
	if cooldownSec <= 0 {
		return true
	}
	return now.Sub(last) >= time.Duration(cooldownSec)*time.Second
}

func (e *Evaluator) markSent(level Level, now time.Time) {
	e.lastSent[level] = now
	t := now
	switch level {
	case LevelWarning:
		e.lastWarningAt = &t
	case LevelCritical:
		e.lastCriticalAt = &t
	case LevelRecovery:
		e.lastRecoveryAt = &t
	}
}
