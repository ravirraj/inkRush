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
