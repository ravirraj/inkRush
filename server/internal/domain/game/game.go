package game

type GameStruct struct {
	Status                string
	CurrentRound          int64
	MaxRound              int64
	DrawerIndex           int
	CurrentDrawerPlayerId string
	CurrentWord           string
	GussedPlayerIds       []string
	Scores                map[string]int
}
