package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/ravirraj/inkRush/server/internal/domain/game"
	"github.com/ravirraj/inkRush/server/internal/domain/player"
	"github.com/ravirraj/inkRush/server/internal/domain/room"
	randomid "github.com/ravirraj/inkRush/server/internal/pkg/RandomID"
	"github.com/ravirraj/inkRush/server/internal/pkg/words"
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
				Game:         &game.GameStruct{Status: room.Wating},
			}

			h.roomStore.Add(&room)

			roomPlayerPayload := []protocol.RoomPlayerPayload{}

			for _, player := range room.Players {
				player, exists := h.sessionStore.GetByID(player)
				if exists == false {
					continue
				}
				roomPlayerPayload = append(roomPlayerPayload, protocol.RoomPlayerPayload{
					PlayerId: player.Id,
					Nickname: player.Nickname,
				})
			}

			roomReadyPayload := protocol.RoomReadyPayload{
				Code:         code,
				HostPlayerID: playerPresentInSession.Id,
				Players:      roomPlayerPayload,
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
		case protocol.EventGameStart:

			var GameStartPayload protocol.GameStartPayload

			err := json.Unmarshal(envelope.PayLoad, &GameStartPayload)
			if err != nil {
				fmt.Println("Error in EventGameStart", err)
				continue

			}

			if GameStartPayload.PlayerId == "" {
				fmt.Println("EventGameStart,Player Id is Required")
				errpaylaod := protocol.ErrorPayload{
					ErrorMessage: "Player Id is required",
				}
				SendEnvelope(conn, protocol.EventSystemError, errpaylaod)
				continue
			}

			playerInStore, exists := h.sessionStore.GetByID(GameStartPayload.PlayerId)
			if exists == false {
				fmt.Println("|EventGameStart,Player Do No exist in session store")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is not in session",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue

			}

			if playerInStore.CurrentRoomCode == "" {
				fmt.Println("EventGameStart,Player is not in any room")

				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player Is not in any room",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue

			}

			roomInStore, exists := h.roomStore.GetByCode(playerInStore.CurrentRoomCode)
			if exists == false {
				fmt.Println("EventGameStart,Room does not exists")

				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Room does not exists ",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}
			if roomInStore.HostPlayerID != playerInStore.Id {
				fmt.Println("EventGameStart, Player is not the host")

				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is not host",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			if roomInStore.Game.Status != room.Wating {
				fmt.Println("Game stared ")

				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Game already started",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			scoreMap := make(map[string]int)

			pickedWord := words.GetRandomWord()

			now := time.Now()
			turnDuration := 80

			for _, player := range roomInStore.Players {
				scoreMap[player] = 0
			}
			roomInStore.Game = &game.GameStruct{
				Status:                room.In_Progress,
				CurrentRound:          1,
				DrawerIndex:           0,
				CurrentDrawerPlayerId: roomInStore.Players[0],
				CurrentWord:           pickedWord,
				GussedPlayerIds:       []string{},
				MaxRound:              3,
				Scores:                scoreMap,
				TurnDurationSecond:    turnDuration,
				TurnStartAt:           now,
				TurnEndsAt:            now.Add(time.Duration(turnDuration) * time.Second),
			}

			h.BoardcastGameReady(roomInStore)
			h.BoardcastTurnStared(roomInStore)

		case protocol.EventGuessSubmit:
			var GuessSubmitPayload protocol.GuessSubmitPayload

			err := json.Unmarshal(envelope.PayLoad, &GuessSubmitPayload)
			if err != nil {
				fmt.Println("ERR", err)
			}
			if GuessSubmitPayload.Guess == "" {
				fmt.Println("Guess is required  !!!")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Guess is required",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			if GuessSubmitPayload.PlayerId == "" {
				fmt.Println("PlayerId is required  !!!")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "PlayerId is required",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			currentPlayer, exists := h.sessionStore.GetByID(GuessSubmitPayload.PlayerId)
			if exists == false {

				fmt.Println(" Player is not in session")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is not in session",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			if currentPlayer.CurrentRoomCode == "" {
				fmt.Println("Player is not in room")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is not in room",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			currentRoom, exists := h.roomStore.GetByCode(currentPlayer.CurrentRoomCode)

			if exists == false {

				fmt.Println("Room Does Not Exists")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Room Does Not Exists",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue

			}

			if currentRoom.Game.Status == room.Wating {
				fmt.Println("Room Status is Wating ")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Room status Is Waiting",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}
			if currentRoom.Game.CurrentDrawerPlayerId == GuessSubmitPayload.PlayerId {
				fmt.Println("Player is Drawer")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is Drawer",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			hasGuessed := slices.Contains(currentRoom.Game.GussedPlayerIds, GuessSubmitPayload.PlayerId)
			if hasGuessed {
				fmt.Println("Player Already Guessed The Answer")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player Already Guessed Answer",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			word := strings.ToLower(currentRoom.Game.CurrentWord)
			word = strings.ReplaceAll(word, " ", "")

			useGuessedWord := strings.ToLower(GuessSubmitPayload.Guess)
			useGuessedWord = strings.ReplaceAll(useGuessedWord, " ", "")

			if time.Now().After(currentRoom.Game.TurnEndsAt) {
				fmt.Println("Round Expired")
				errPayload := protocol.ErrorPayload{
					ErrorMessage: "Round Expired",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPayload)
				continue
			}

			maxPt := 100
			minPt := 20

			remaining := time.Until(currentRoom.Game.TurnEndsAt)
			total := time.Duration(currentRoom.Game.TurnDurationSecond) * time.Second

			ratio := float64(remaining) / float64(total)

			if ratio < 0 {
				ratio = 0
			}
			if ratio > 1 {
				ratio = 1
			}

			points := minPt + int(float64(maxPt-minPt)*ratio)
			fmt.Println(points)

			GuessResultPayload := protocol.GuessResultPayload{
				PlayerId:           currentPlayer.Id,
				IsCorrect:          false,
				Nickname:           currentPlayer.Nickname,
				PointAwareded:      0,
				DrawerPointAwarded: 0,
				Scores:             currentRoom.Game.Scores,
			}
			if word != useGuessedWord {
				h.BoardcastGuessResult(currentRoom, GuessResultPayload)

			} else {
				currentRoom.Game.GussedPlayerIds = append(currentRoom.Game.GussedPlayerIds, currentPlayer.Id)
				currentRoom.Game.Scores[currentPlayer.Id] += points
				currentRoom.Game.Scores[currentRoom.Game.CurrentDrawerPlayerId] += 20
				GuessResultPayload.PointAwareded = points
				GuessResultPayload.DrawerPointAwarded = currentRoom.Game.Scores[currentRoom.Game.CurrentDrawerPlayerId]

				GuessResultPayload.IsCorrect = true
				h.BoardcastGuessResult(currentRoom, GuessResultPayload)
			}

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

	// roomPlayerPaylaod := protocol.RoomPlayerPayload{}
	players := []protocol.RoomPlayerPayload{}
	for _, player := range currentRoom.Players {

		currentPlayer, exists := h.sessionStore.GetByID(player)

		if exists == false {
			continue
		}

		players = append(players, protocol.RoomPlayerPayload{
			PlayerId: currentPlayer.Id,
			Nickname: currentPlayer.Nickname,
		})

	}
	RoomReadyPayload := protocol.RoomReadyPayload{
		Code:         currentRoom.Code,
		HostPlayerID: currentRoom.HostPlayerID,
		Players:      players,
	}

	for _, player := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(player)
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

func (h *WebSocketHandler) BoardcastGameReady(currentRoom *room.Room) {

	GameStartedPayload := protocol.GameStartedPayload{
		RoomCode:              currentRoom.Code,
		CurrentRound:          currentRoom.Game.CurrentRound,
		CurrentDrawerPlayerId: currentRoom.Game.CurrentDrawerPlayerId,
	}
	for _, player := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(player)
		if exists == false {
			continue
		}

		SendEnvelope(conn, protocol.EventGameStarted, GameStartedPayload)
	}
}

func (h *WebSocketHandler) BoardcastTurnStared(currentRoom *room.Room) {
	maskedWord := words.GetMaskedWord(currentRoom.Game.CurrentWord)

	for _, playerId := range currentRoom.Players {
		TurnStaredPayload := protocol.TurnStaredPayload{
			RoomCode:              currentRoom.Code,
			CurrentRound:          currentRoom.Game.CurrentRound,
			CurrentDrawerPlayerId: currentRoom.Game.CurrentDrawerPlayerId,
		}
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if exists == false {
			continue
		}
		if playerId == currentRoom.Game.CurrentDrawerPlayerId {

			TurnStaredPayload.Word = currentRoom.Game.CurrentWord
			TurnStaredPayload.MaskedWord = maskedWord

		} else {
			TurnStaredPayload.Word = ""
			TurnStaredPayload.MaskedWord = maskedWord
		}
		SendEnvelope(conn, protocol.EventTurnStared, TurnStaredPayload)
	}
}

func (h *WebSocketHandler) BoardcastGuessResult(currentRomm *room.Room, payload protocol.GuessResultPayload) {
	for _, playerId := range currentRomm.Players {
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if exists == false {
			continue
		}

		SendEnvelope(conn, protocol.EventGuessResult, payload)
	}
}
