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
	EventGameEnded = "game:ended"
	EventDrawStroke   = "draw:stroke"
	EventDrawClear    = "draw:clear"
	EventChatMessage  = "chat:message"
	EventWordOptions   = "word:options"
	EventWordSelecting = "word:selecting"
	EventWordSelect    = "word:select"
	EventTurnEnded     = "turn:ended"
	EventGameReset     = "game:reset"
)

