package game

import "time"

type GameStruct struct {
	Status                string
	CurrentRound          int
	MaxRound              int
	DrawerIndex           int
	CurrentDrawerPlayerId string
	CurrentWord           string
	GussedPlayerIds       []string
	Scores                map[string]int
	TurnDurationSecond    int
	TurnStartAt time.Time
	TurnEndsAt time.Time

}
