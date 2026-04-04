package protocol

const (
	EventSystemPing   = "system:ping"
	EventSystemPong   = "system:pong"
	EventDebugEcho    = "debug:echo"
	EventSystemError  = "system:error"
	EventSessionInit  = "session:init"
	EventSessionReady = "session:ready"
	EventRoomCreate   = "room:create"
	EventRoomReady    = "room:ready"
	EventRoomJoin     = "room:join"
	EventGameStart    = "game:start"
	EventGameStarted  = "game:started"
	EventTurnStared   = "turn:started"
	EventGuessSubmit  = "guess:submit"
	EventGuessResult  = "guess:result"
)
