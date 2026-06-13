package protocol

type SessionInitPayload struct {
	Nickname string `json:"nickname"`
}

type SessionReadyPayload struct {
	Nickname string `json:"nickname"`
	PlayerID string `json:"playerId"`
}

type ErrorPayload struct {
	ErrorMessage string
}

type RoomCreatePayload struct {
	PlayerID string `json:"playerID"`
}

type RoomReadyPayload struct {
	Code         string              `json:"code"`
	HostPlayerID string              `json:"hostPlayerID"`
	Players      []RoomPlayerPayload `json:"players"`
}

type RoomJoinPayload struct {
	Code     string `json:"code"`
	PlayerID string `json:"playerID"`
}

type RoomPlayerPayload struct {
	Nickname string `json:"nickname"`

	PlayerId string `json:"playerId"`
}

type GameStartPayload struct {
	PlayerId string `json:"playerId"`
}

type GameStartedPayload struct {
	RoomCode              string `json:"code"`
	CurrentRound          int    `json:"currentRound"`
	CurrentDrawerPlayerId string `json:"currentDrawerPlayerId"`
	Status                string `json:"status"`
}

type TurnStaredPayload struct {
	RoomCode string `json:"code"`

	CurrentRound          int    `json:"currentRound"`
	CurrentDrawerPlayerId string `json:"currentDrawerPlayerId"`
	Status                string `json:"status"`

	Word       string `json:"word"`
	MaskedWord string `json:"maskedWord"`
}

type GuessSubmitPayload struct {
	PlayerId string `json:"playerId"`
	Guess    string `josn:"guess"`
}

type GuessResultPayload struct {
	PlayerId           string         `json:"playerId"`
	IsCorrect          bool           `json:"isCorrect"`
	Nickname           string         `json:"nickname"`
	PointAwareded      int            `json:"pointsAwarded"`
	DrawerPointAwarded int            `json:"drawerPoints"`
	Scores             map[string]int `json:"score"`
}

type GameEndedPayload struct {
	Score map[string]int `json:"score"`
}

type DrawStrokePayload struct {
	PlayerId  string  `json:"playerId"`
	PrevX     float64 `json:"prevX"`
	PrevY     float64 `json:"prevY"`
	CurrentX  float64 `json:"currentX"`
	CurrentY  float64 `json:"currentY"`
	Color     string  `json:"color"`
	LineWidth int     `json:"lineWidth"`
}

type DrawClearPayload struct {
	PlayerId string `json:"playerId"`
}

type ChatMessagePayload struct {
	PlayerId string `json:"playerId"`
	Nickname string `json:"nickname"`
	Message  string `json:"message"`
	Type     string `json:"type"`
}

