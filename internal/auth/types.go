package auth

import "time"

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleViewer Role = "viewer"
)

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Role     Role   `json:"role"`
}

type UserAuditEntry struct {
	ID             int64     `json:"id"`
	ActorUserID    int64     `json:"actor_user_id"`
	ActorUsername  string    `json:"actor_username"`
	Action         string    `json:"action"`
	TargetUserID   int64     `json:"target_user_id"`
	TargetUsername string    `json:"target_username"`
	Details        string    `json:"details"`
	CreatedAt      time.Time `json:"created_at"`
}
