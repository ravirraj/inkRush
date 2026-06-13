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
	TurnStartAt           time.Time
	TurnEndsAt            time.Time
	TurnNumber            int
	CurrentWordOptions    []string
	TurnPoints            map[string]int
	HintRevealedPositions []bool // tracks which char positions have been hinted
}
