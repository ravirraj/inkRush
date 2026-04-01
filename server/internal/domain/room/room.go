package room

import "github.com/ravirraj/inkRush/server/internal/domain/game"

const (
	Wating      = "wating"
	In_Progress = "in_progress"
)

type Room struct {
	Code         string
	HostPlayerID string
	Players      []string
	Game         *game.GameStruct
}
