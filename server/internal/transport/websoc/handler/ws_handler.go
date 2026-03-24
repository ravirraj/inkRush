package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/ravirraj/inkRush/server/internal/domain/player"
	"github.com/ravirraj/inkRush/server/internal/store/memory"
	"github.com/ravirraj/inkRush/server/internal/transport/websoc/protocol"
)

type WebSocketHandler struct {
	sessionStore *memory.SessionStore
}
type EchoMessage struct {
	Message string `json:"message"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewWebSocketHandler() *WebSocketHandler {

	return &WebSocketHandler{
		sessionStore: memory.NewSessionStore(),
	}
}

func (h *WebSocketHandler) Handle(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer conn.Close()

	for {
		var envelope protocol.Envelope

		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Error ", err)
			break
		}

		err = json.Unmarshal(message, &envelope)
		fmt.Println(envelope)
		if err != nil {
			fmt.Println("error ", err)
			continue

		}

		switch envelope.Type {
		case protocol.EventDebugEcho:
			var paylaod EchoMessage
			err = json.Unmarshal(envelope.PayLoad, &paylaod)
			if err != nil {
				fmt.Println("ERROR ", err)
				continue

			}
			SendEnvelope(conn, protocol.EventDebugEcho, paylaod)

		case protocol.EventSystemPing:
			var paylaod struct{}

			SendEnvelope(conn, protocol.EventSystemPong, &paylaod)

		case protocol.EventSessionInit:

			// basicaly here we are validating the user and adding it to the store (session)
			var sessionInitPaylaod protocol.SessionInitPayload

			err := json.Unmarshal(envelope.PayLoad, &sessionInitPaylaod)

			if err != nil {
				fmt.Println("error ", err)
				continue
			}
			if sessionInitPaylaod.Nickname == "" {
				errPaylaod := protocol.ErrorPayload{
					ErrorMessage: "Invalid UserName",
				}
				fmt.Println("invalid nickname")
				SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
				continue
			}
			idGen := time.Now().UnixNano()
			convertedId := strconv.FormatInt(idGen, 10)
			playerId := sessionInitPaylaod.Nickname + convertedId
			player := player.Player{
				Id:              playerId,
				Nickname:        sessionInitPaylaod.Nickname,
				CurrentRoomCode: "",
			}

			sessionReadyPayload := protocol.SessionReadyPayload{
				Nickname: player.Nickname,
				PlayerID: player.Id,
			}

			h.sessionStore.Add(&player)

			SendEnvelope(conn, protocol.EventSessionReady, sessionReadyPayload)

		default:
			var payload struct {
				Message string
			}
			payload.Message = "System Error"

			SendEnvelope(conn, protocol.EventSystemError, payload)
		}

	}

}

//this function send the data to the client but in structured way

func SendEnvelope(conn *websocket.Conn, messageType string, payload any) error {

	var SendEnvelopeStruct protocol.Envelope
	SendEnvelopeStruct.Type = messageType
	message, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("Error %s n", err)

	}

	SendEnvelopeStruct.PayLoad = message

	err = conn.WriteJSON(SendEnvelopeStruct)
	if err != nil {
		fmt.Println(err)
		return err
	}

	return nil
}
