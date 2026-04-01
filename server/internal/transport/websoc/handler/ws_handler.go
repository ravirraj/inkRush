package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/ravirraj/inkRush/server/internal/domain/player"
	"github.com/ravirraj/inkRush/server/internal/domain/room"
	randomid "github.com/ravirraj/inkRush/server/internal/pkg/RandomID"
	"github.com/ravirraj/inkRush/server/internal/store/memory"
	"github.com/ravirraj/inkRush/server/internal/transport/websoc/protocol"
)

type WebSocketHandler struct {
	sessionStore *memory.SessionStore
	roomStore    *memory.RoomStore
	connStore    *memory.ConnStore
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
		roomStore:    memory.NewRoomStore(),
		connStore:    memory.NewConnectionStore(),
	}
}

func (h *WebSocketHandler) Handle(c *gin.Context) {
	var currentPlayerId string

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
			fmt.Println("Error disconnect", err)
			h.handleDisconnet(currentPlayerId)
			fmt.Println(currentPlayerId, "connection closed")
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

			currentPlayerId = player.Id
			fmt.Println("curretn player in sesssion inti ", currentPlayerId)
			h.sessionStore.Add(&player)

			h.connStore.Add(player.Id, conn)

			SendEnvelope(conn, protocol.EventSessionReady, sessionReadyPayload)

		case protocol.EventRoomCreate:

			var roomInitPayload protocol.RoomCreatePayload
			players := []string{}

			err := json.Unmarshal(envelope.PayLoad, &roomInitPayload)
			if err != nil {
				fmt.Println("Error ", err)
				continue
			}

			if roomInitPayload.PlayerID == "" {
				errPayload := protocol.ErrorPayload{
					ErrorMessage: "Player ID is required",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPayload)
				continue
			}

			playerPresentInSession, exists := h.sessionStore.GetByID(roomInitPayload.PlayerID)
			if exists == false {
				errPayload := protocol.ErrorPayload{
					ErrorMessage: "Player is Not Present In The Session",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPayload)
				continue
			}

			var code string

			for {
				code = randomid.GenerateID(6)

				_, exists = h.roomStore.GetByCode(code)
				if exists == false {
					break
				}

			}
			playerPresentInSession.CurrentRoomCode = code
			players = append(players, playerPresentInSession.Id)
			room := room.Room{
				Code:         code,
				HostPlayerID: playerPresentInSession.Id,
				Players:      players,
			}

			h.roomStore.Add(&room)

			roomReadyPayload := protocol.RoomReadyPayload{
				Code:         code,
				HostPlayerID: playerPresentInSession.Id,
				Players:      room.Players,
			}

			SendEnvelope(conn, protocol.EventRoomReady, roomReadyPayload)

		case protocol.EventRoomJoin:
			fmt.Println("current player", currentPlayerId)
			var RoomJoinPayload protocol.RoomJoinPayload
			err := json.Unmarshal(envelope.PayLoad, &RoomJoinPayload)
			if err != nil {
				fmt.Println("Error ", err)
				continue

			}

			if (RoomJoinPayload.Code == "") || (RoomJoinPayload.PlayerID == "") {
				fmt.Println("Room Code or player id  is not provided")
				errPaylaod := protocol.ErrorPayload{
					ErrorMessage: "room code and playerid is required",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
				continue
			}

			currentRoom, exists := h.roomStore.GetByCode(RoomJoinPayload.Code)
			if exists == false {
				fmt.Println("Room Does not exists Check the code ")
				errPaylaod := protocol.ErrorPayload{
					ErrorMessage: "room code is invalid or room does not exist",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
				continue
			}

			currentPlayer, exists := h.sessionStore.GetByID(RoomJoinPayload.PlayerID)
			if exists == false {
				fmt.Println("Player does not exist in the session store")
				errPaylaod := protocol.ErrorPayload{
					ErrorMessage: "player id is not valid or player does not eixts in the session store",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
				continue
			}

			if currentPlayer.CurrentRoomCode != "" {
				fmt.Println("playerID already exists in other room ")
				errPaylaod := protocol.ErrorPayload{
					ErrorMessage: "Player is Already Present In other room",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
				continue

			}
			// for _, playerId := range currentRoom.Players {
			// 	if currentPlayer.Id == playerId {
			// 		fmt.Println("playerID already exists in room ")
			// 		errPaylaod := protocol.ErrorPayload{
			// 			ErrorMessage: "Player is Already Present In room",
			// 		}
			// 		SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
			// 		break
			// 	}
			// }

			// playersID := currentRoom.Players

			contains := slices.Contains(currentRoom.Players, currentPlayer.Id)
			if contains {

				fmt.Println("playerID already exists in room ")
				errPaylaod := protocol.ErrorPayload{
					ErrorMessage: "Player is Already Present In room",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
				continue

			}

			currentPlayer.CurrentRoomCode = RoomJoinPayload.Code
			currentRoom.Players = append(currentRoom.Players, RoomJoinPayload.PlayerID)

			// roomReadyPayload := protocol.RoomReadyPayload{
			// 	Code:         currentRoom.Code,
			// 	HostPlayerID: currentRoom.HostPlayerID,
			// 	Players:      currentRoom.Players,
			// }
			h.BoardcastRoomReady(currentRoom)
		default:
			errPaylaod := protocol.ErrorPayload{
				ErrorMessage: "Unkonwn Error",
			}

			SendEnvelope(conn, protocol.EventSystemError, errPaylaod)
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

func (h *WebSocketHandler) BoardcastRoomReady(currentRoom *room.Room) {
	RoomReadyPayload := protocol.RoomReadyPayload{
		Code:         currentRoom.Code,
		HostPlayerID: currentRoom.HostPlayerID,
		Players:      currentRoom.Players,
	}

	for _, playerId := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if exists == false {
			continue
		}

		SendEnvelope(conn, protocol.EventRoomReady, RoomReadyPayload)
	}
}

func (h *WebSocketHandler) handleDisconnet(playerId string) {

	player, exists := h.sessionStore.GetByID(playerId)
	if exists == false {
		h.connStore.Remove(playerId)
		return
	}
	h.connStore.Remove(playerId)

	if player.CurrentRoomCode == "" {
		h.sessionStore.Remove(playerId)
		return
	}
	currentRoom, exists := h.roomStore.GetByCode(player.CurrentRoomCode)
	if exists == false {
		h.sessionStore.Remove(playerId)
		return
	}

	players := []string{}

	for _, playerId := range currentRoom.Players {
		if playerId != player.Id {
			players = append(players, playerId)
		}
	}
	currentRoom.Players = players

	if len(currentRoom.Players) == 0 {
		h.roomStore.Remove(currentRoom.Code)
		h.sessionStore.Remove(playerId)
		return
	}

	if currentRoom.HostPlayerID == playerId {
		currentRoom.HostPlayerID = currentRoom.Players[0]
	}

	h.BoardcastRoomReady(currentRoom)

	h.sessionStore.Remove(playerId)
}
