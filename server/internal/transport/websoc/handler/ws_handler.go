package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/ravirraj/inkRush/server/internal/transport/websoc/protocol"
)

type WebSocketHandler struct{}
type EchoMessage struct {
	Message string `json:"message"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewWebSocketHandler() *WebSocketHandler {
	return &WebSocketHandler{}
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

		default:
			var payload struct {
				Message string
			}
			payload.Message = "System Error"

			SendEnvelope(conn, protocol.EventSystemError, payload)
		}

	}

}

func SendEnvelope(conn *websocket.Conn, messageType string, payload any) error {

	var SendEnvelopeStruct protocol.Envelope
	SendEnvelopeStruct.Type = messageType
	message, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("Error %s n", err)

	}

	SendEnvelopeStruct.PayLoad = message

	err = conn.WriteJSON(message)
	if err != nil {
		fmt.Println(err)
		return err
	}

	return nil
}
