package handler

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"slices"
	"sort"
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

			h.BoardcastRoomReady(currentRoom)
			h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
				PlayerId: "system",
				Nickname: "System",
				Message:  fmt.Sprintf("%s joined the lobby", currentPlayer.Nickname),
				Type:     "join",
			})
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

			if len(roomInStore.Players) < 3 {
				fmt.Println("EventGameStart, Need at least 3 players to start")

				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Need at least 3 players to start the game",
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

			// Randomize drawer order by shuffling the players list
			rand.Shuffle(len(roomInStore.Players), func(i, j int) {
				roomInStore.Players[i], roomInStore.Players[j] = roomInStore.Players[j], roomInStore.Players[i]
			})

			scoreMap := make(map[string]int)

			pickedWords := words.GetThreeRandomWords()

			now := time.Now()
			selectionDuration := 15

			for _, player := range roomInStore.Players {
				scoreMap[player] = 0
			}
			roomInStore.Game = &game.GameStruct{
				Status:                "selecting_word",
				CurrentRound:          1,
				DrawerIndex:           0,
				CurrentDrawerPlayerId: roomInStore.Players[0],
				CurrentWord:           "",
				CurrentWordOptions:    pickedWords,
				GussedPlayerIds:       []string{},
				MaxRound:              3,
				Scores:                scoreMap,
				TurnDurationSecond:    selectionDuration,
				TurnStartAt:           now,
				TurnEndsAt:            now.Add(time.Duration(selectionDuration) * time.Second),
				TurnNumber:            1,
			}

			h.BoardcastGameReady(roomInStore)
			h.BoardcastWordSelectionState(roomInStore)
			h.ShaduleWordSelectionTimeOut(roomInStore, roomInStore.Game.TurnNumber)

		case protocol.EventGameReset:
			var resetPayload struct {
				PlayerId string `json:"playerId"`
			}
			err := json.Unmarshal(envelope.PayLoad, &resetPayload)
			if err != nil {
				fmt.Println("Error in EventGameReset unmarshal", err)
				continue
			}

			if resetPayload.PlayerId == "" {
				errPayload := protocol.ErrorPayload{
					ErrorMessage: "Player ID is required",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPayload)
				continue
			}

			playerInStore, exists := h.sessionStore.GetByID(resetPayload.PlayerId)
			if !exists {
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is not in session",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			if playerInStore.CurrentRoomCode == "" {
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Player is not in any room",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			roomInStore, exists := h.roomStore.GetByCode(playerInStore.CurrentRoomCode)
			if !exists {
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Room does not exist",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			if roomInStore.HostPlayerID != playerInStore.Id {
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Only the host can reset the game",
				}
				SendEnvelope(conn, protocol.EventSystemError, errMessage)
				continue
			}

			roomInStore.Game = &game.GameStruct{
				Status: room.Wating,
			}

			h.BoardcastRoomReady(roomInStore)

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

			if currentRoom.Game.Status != room.In_Progress {
				fmt.Println("Room Status is not in_progress ")
				errMessage := protocol.ErrorPayload{
					ErrorMessage: "Game is not active (waiting or selecting word)",
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
				h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
					PlayerId: currentPlayer.Id,
					Nickname: currentPlayer.Nickname,
					Message:  GuessSubmitPayload.Guess,
					Type:     "chat",
				})

			} else {
				currentRoom.Game.GussedPlayerIds = append(currentRoom.Game.GussedPlayerIds, currentPlayer.Id)
				currentRoom.Game.Scores[currentPlayer.Id] += points
				currentRoom.Game.Scores[currentRoom.Game.CurrentDrawerPlayerId] += 20
				
				if currentRoom.Game.TurnPoints == nil {
					currentRoom.Game.TurnPoints = make(map[string]int)
				}
				currentRoom.Game.TurnPoints[currentPlayer.Id] += points
				currentRoom.Game.TurnPoints[currentRoom.Game.CurrentDrawerPlayerId] += 20

				GuessResultPayload.PointAwareded = points
				GuessResultPayload.DrawerPointAwarded = currentRoom.Game.Scores[currentRoom.Game.CurrentDrawerPlayerId]
				GuessResultPayload.CorrectWord = currentRoom.Game.CurrentWord // reveal word to correct guesser

				GuessResultPayload.IsCorrect = true
				for _, pid := range currentRoom.Players {
					if pid == currentPlayer.Id || pid == currentRoom.Game.CurrentDrawerPlayerId {
						conn, exists := h.connStore.GetByPlayerID(pid)
						if exists {
							SendEnvelope(conn, protocol.EventGuessResult, GuessResultPayload)
							SendEnvelope(conn, protocol.EventChatMessage, protocol.ChatMessagePayload{
								PlayerId: "system",
								Nickname: "System",
								Message:  fmt.Sprintf("%s guessed the word!", currentPlayer.Nickname),
								Type:     "correct",
							})
						}
					}
				}
			}

			if len(currentRoom.Game.GussedPlayerIds) == len(currentRoom.Players)-1 {
				h.EndDrawingTurn(currentRoom)
			}

		case protocol.EventDrawStroke:
			var drawStrokePayload protocol.DrawStrokePayload
			err := json.Unmarshal(envelope.PayLoad, &drawStrokePayload)
			if err != nil {
				fmt.Println("ERR in EventDrawStroke unmarshal:", err)
				continue
			}

			if drawStrokePayload.PlayerId == "" {
				fmt.Println("EventDrawStroke: Player ID is required")
				continue
			}

			currentPlayer, exists := h.sessionStore.GetByID(drawStrokePayload.PlayerId)
			if !exists {
				fmt.Println("EventDrawStroke: Player does not exist in session store")
				continue
			}

			if currentPlayer.CurrentRoomCode == "" {
				fmt.Println("EventDrawStroke: Player is not in any room")
				continue
			}

			currentRoom, exists := h.roomStore.GetByCode(currentPlayer.CurrentRoomCode)
			if !exists {
				fmt.Println("EventDrawStroke: Room does not exist")
				continue
			}

			if currentRoom.Game.Status != room.In_Progress {
				fmt.Println("EventDrawStroke: Game is not in progress")
				continue
			}

			if currentRoom.Game.CurrentDrawerPlayerId != drawStrokePayload.PlayerId {
				fmt.Println("EventDrawStroke: Sender is not the current drawer")
				continue
			}

			// Broadcast to other players in the room
			for _, playerId := range currentRoom.Players {
				if playerId == drawStrokePayload.PlayerId {
					continue
				}
				conn, exists := h.connStore.GetByPlayerID(playerId)
				if !exists {
					continue
				}
				SendEnvelope(conn, protocol.EventDrawStroke, drawStrokePayload)
			}

		case protocol.EventDrawClear:
			var drawClearPayload protocol.DrawClearPayload
			err := json.Unmarshal(envelope.PayLoad, &drawClearPayload)
			if err != nil {
				fmt.Println("ERR in EventDrawClear unmarshal:", err)
				continue
			}

			if drawClearPayload.PlayerId == "" {
				fmt.Println("EventDrawClear: Player ID is required")
				continue
			}

			currentPlayer, exists := h.sessionStore.GetByID(drawClearPayload.PlayerId)
			if !exists {
				fmt.Println("EventDrawClear: Player does not exist in session store")
				continue
			}

			if currentPlayer.CurrentRoomCode == "" {
				fmt.Println("EventDrawClear: Player is not in any room")
				continue
			}

			currentRoom, exists := h.roomStore.GetByCode(currentPlayer.CurrentRoomCode)
			if !exists {
				fmt.Println("EventDrawClear: Room does not exist")
				continue
			}

			if currentRoom.Game.Status != room.In_Progress {
				fmt.Println("EventDrawClear: Game is not in progress")
				continue
			}

			if currentRoom.Game.CurrentDrawerPlayerId != drawClearPayload.PlayerId {
				fmt.Println("EventDrawClear: Sender is not the current drawer")
				continue
			}

			// Broadcast to other players in the room
			for _, playerId := range currentRoom.Players {
				if playerId == drawClearPayload.PlayerId {
					continue
				}
				conn, exists := h.connStore.GetByPlayerID(playerId)
				if !exists {
					continue
				}
				SendEnvelope(conn, protocol.EventDrawClear, drawClearPayload)
			}

		case protocol.EventChatMessage:
			var chatPayload protocol.ChatMessagePayload
			err := json.Unmarshal(envelope.PayLoad, &chatPayload)
			if err != nil {
				fmt.Println("ERR in EventChatMessage unmarshal:", err)
				continue
			}

			if chatPayload.PlayerId == "" {
				fmt.Println("EventChatMessage: Player ID is required")
				continue
			}

			currentPlayer, exists := h.sessionStore.GetByID(chatPayload.PlayerId)
			if !exists {
				fmt.Println("EventChatMessage: Player does not exist in session store")
				continue
			}

			if currentPlayer.CurrentRoomCode == "" {
				fmt.Println("EventChatMessage: Player is not in any room")
				continue
			}

			currentRoom, exists := h.roomStore.GetByCode(currentPlayer.CurrentRoomCode)
			if !exists {
				fmt.Println("EventChatMessage: Room does not exist")
				continue
			}

			if strings.TrimSpace(chatPayload.Message) == "" {
				continue
			}

			// Validate drawer chat constraints
			if currentRoom.Game != nil && currentRoom.Game.Status == room.In_Progress {
				if currentRoom.Game.CurrentDrawerPlayerId == chatPayload.PlayerId {
					fmt.Println("EventChatMessage: Drawer is blocked from chatting during turn")
					errPayload := protocol.ErrorPayload{
						ErrorMessage: "Drawer cannot chat during their drawing turn!",
					}
					SendEnvelope(conn, protocol.EventSystemError, errPayload)
					continue
				}
			}

			// Broadcast message to room
			chatPayload.Nickname = currentPlayer.Nickname
			chatPayload.Type = "chat"
			h.BroadcastChatMessage(currentRoom, chatPayload)

		case protocol.EventWordSelect:
			var selectPayload protocol.WordSelectPayload
			err := json.Unmarshal(envelope.PayLoad, &selectPayload)
			if err != nil {
				fmt.Println("ERR in EventWordSelect unmarshal:", err)
				continue
			}

			if selectPayload.PlayerId == "" || selectPayload.Word == "" {
				fmt.Println("EventWordSelect: Player ID and Word are required")
				continue
			}

			currentPlayer, exists := h.sessionStore.GetByID(selectPayload.PlayerId)
			if !exists {
				fmt.Println("EventWordSelect: Player does not exist in session store")
				continue
			}

			if currentPlayer.CurrentRoomCode == "" {
				fmt.Println("EventWordSelect: Player is not in any room")
				continue
			}

			currentRoom, exists := h.roomStore.GetByCode(currentPlayer.CurrentRoomCode)
			if !exists {
				fmt.Println("EventWordSelect: Room does not exist")
				continue
			}

			if currentRoom.Game == nil || currentRoom.Game.Status != "selecting_word" {
				fmt.Println("EventWordSelect: Game is not in word selection phase")
				continue
			}

			if currentRoom.Game.CurrentDrawerPlayerId != selectPayload.PlayerId {
				fmt.Println("EventWordSelect: Sender is not the current drawer")
				continue
			}

			// Validate chosen word
			valid := false
			chosenWord := ""
			for _, option := range currentRoom.Game.CurrentWordOptions {
				if strings.EqualFold(option, selectPayload.Word) {
					valid = true
					chosenWord = option
					break
				}
			}

			if !valid {
				fmt.Println("EventWordSelect: Word is not in options list")
				errPayload := protocol.ErrorPayload{
					ErrorMessage: "Selected word is not in your available choices!",
				}
				SendEnvelope(conn, protocol.EventSystemError, errPayload)
				continue
			}

			h.StartDrawingTurn(currentRoom, chosenWord)

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
	h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
		PlayerId: "system",
		Nickname: "System",
		Message:  fmt.Sprintf("%s left the lobby", player.Nickname),
		Type:     "leave",
	})

	h.sessionStore.Remove(playerId)
}

func (h *WebSocketHandler) BoardcastGameReady(currentRoom *room.Room) {

	GameStartedPayload := protocol.GameStartedPayload{
		RoomCode:              currentRoom.Code,
		CurrentRound:          currentRoom.Game.CurrentRound,
		CurrentDrawerPlayerId: currentRoom.Game.CurrentDrawerPlayerId,
		Status:                currentRoom.Game.Status,
	}
	for _, player := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(player)
		if exists == false {
			continue
		}

		SendEnvelope(conn, protocol.EventGameStarted, GameStartedPayload)
	}

	h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
		PlayerId: "system",
		Nickname: "System",
		Message:  "Game has started!",
		Type:     "system",
	})
}

func (h *WebSocketHandler) BoardcastTurnStared(currentRoom *room.Room) {
	maskedWord := words.GetMaskedWord(currentRoom.Game.CurrentWord)

	for _, playerId := range currentRoom.Players {
		TurnStaredPayload := protocol.TurnStaredPayload{
			RoomCode:              currentRoom.Code,
			CurrentRound:          currentRoom.Game.CurrentRound,
			CurrentDrawerPlayerId: currentRoom.Game.CurrentDrawerPlayerId,
			Status:                currentRoom.Game.Status,
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

	drawer, exists := h.sessionStore.GetByID(currentRoom.Game.CurrentDrawerPlayerId)
	drawerNickname := "Someone"
	if exists {
		drawerNickname = drawer.Nickname
	}
	h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
		PlayerId: "system",
		Nickname: "System",
		Message:  fmt.Sprintf("%s is drawing now!", drawerNickname),
		Type:     "system",
	})
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

func (h *WebSocketHandler) BoardcastGameEnded(currentRoom *room.Room) {
	currentRoom.Game.Status = "ended"

	var entries []protocol.LeaderboardEntry
	for _, pid := range currentRoom.Players {
		nickname := "Unknown"
		p, exists := h.sessionStore.GetByID(pid)
		if exists {
			nickname = p.Nickname
		}
		score := 0
		if currentRoom.Game.Scores != nil {
			score = currentRoom.Game.Scores[pid]
		}
		entries = append(entries, protocol.LeaderboardEntry{
			PlayerId: pid,
			Nickname: nickname,
			Score:    score,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Score > entries[j].Score
	})

	var winners []string
	if len(entries) > 0 {
		highestScore := entries[0].Score
		for _, entry := range entries {
			if entry.Score == highestScore {
				winners = append(winners, entry.Nickname)
			} else {
				break
			}
		}
	}

	gameEndedPayload := protocol.GameEndedPayload{
		Winners:     winners,
		Leaderboard: entries,
		Scores:      currentRoom.Game.Scores,
	}

	for _, playerId := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if exists == false {
			continue
		}
		SendEnvelope(conn, protocol.EventGameEnded, gameEndedPayload)
	}

	h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
		PlayerId: "system",
		Nickname: "System",
		Message:  "Game has ended! Final scores are ready.",
		Type:     "system",
	})
}

func (h *WebSocketHandler) AdvanceTurn(currentRoom *room.Room) {
	if len(currentRoom.Players) == 0 {
		return
	}

	currentIndex := currentRoom.Game.DrawerIndex
	nextIndex := (currentIndex + 1) % len(currentRoom.Players)

	currentRoom.Game.DrawerIndex = nextIndex
	currentRoom.Game.CurrentDrawerPlayerId = currentRoom.Players[nextIndex]

	if nextIndex == 0 {
		currentRoom.Game.CurrentRound++

	}
	if currentRoom.Game.CurrentRound > currentRoom.Game.MaxRound {

		h.BoardcastGameEnded(currentRoom)
		return

	}

	currentRoom.Game.TurnNumber++
	h.StartWordSelectionPhase(currentRoom)
}

func (h *WebSocketHandler) StartWordSelectionPhase(currentRoom *room.Room) {
	currentRoom.Game.Status = "selecting_word"
	currentRoom.Game.CurrentWordOptions = words.GetThreeRandomWords()
	currentRoom.Game.CurrentWord = ""
	currentRoom.Game.GussedPlayerIds = []string{}

	now := time.Now()
	selectionDuration := 15
	currentRoom.Game.TurnDurationSecond = selectionDuration
	currentRoom.Game.TurnStartAt = now
	currentRoom.Game.TurnEndsAt = now.Add(time.Duration(selectionDuration) * time.Second)

	h.BoardcastGameReady(currentRoom)
	h.BoardcastWordSelectionState(currentRoom)
	h.ShaduleWordSelectionTimeOut(currentRoom, currentRoom.Game.TurnNumber)
}

func (h *WebSocketHandler) BoardcastWordSelectionState(currentRoom *room.Room) {
	for _, playerId := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if !exists {
			continue
		}
		if playerId == currentRoom.Game.CurrentDrawerPlayerId {
			payload := protocol.WordOptionsPayload{
				RoomCode:              currentRoom.Code,
				CurrentRound:          currentRoom.Game.CurrentRound,
				CurrentDrawerPlayerId: currentRoom.Game.CurrentDrawerPlayerId,
				Status:                currentRoom.Game.Status,
				Words:                 currentRoom.Game.CurrentWordOptions,
			}
			SendEnvelope(conn, protocol.EventWordOptions, payload)
		} else {
			payload := protocol.WordSelectingPayload{
				RoomCode:              currentRoom.Code,
				CurrentRound:          currentRoom.Game.CurrentRound,
				CurrentDrawerPlayerId: currentRoom.Game.CurrentDrawerPlayerId,
				Status:                currentRoom.Game.Status,
			}
			SendEnvelope(conn, protocol.EventWordSelecting, payload)
		}
	}
}

func (h *WebSocketHandler) StartDrawingTurn(currentRoom *room.Room, word string) {
	currentRoom.Game.Status = room.In_Progress // which is "in_progress"
	currentRoom.Game.CurrentWord = word
	currentRoom.Game.TurnPoints = make(map[string]int)

	now := time.Now()
	turnDuration := 80
	currentRoom.Game.TurnDurationSecond = turnDuration
	currentRoom.Game.TurnStartAt = now
	currentRoom.Game.TurnEndsAt = now.Add(time.Duration(turnDuration) * time.Second)

	h.BoardcastTurnStared(currentRoom)
	h.ShaduleTurnTimeOut(currentRoom, currentRoom.Game.TurnNumber)
}

func (h *WebSocketHandler) ShaduleWordSelectionTimeOut(currentRoom *room.Room, turnNumber int) {
	waitDuration := time.Until(currentRoom.Game.TurnEndsAt)
	if waitDuration <= 0 {
		return
	}
	go func() {
		time.Sleep(waitDuration)
		if currentRoom.Game == nil {
			return
		}
		if currentRoom.Game.Status != "selecting_word" {
			return
		}
		if currentRoom.Game.TurnNumber != turnNumber {
			return
		}

		fallbackWord := ""
		if len(currentRoom.Game.CurrentWordOptions) > 0 {
			fallbackWord = currentRoom.Game.CurrentWordOptions[0]
		} else {
			fallbackWord = words.GetRandomWord()
		}

		h.StartDrawingTurn(currentRoom, fallbackWord)
	}()
}

func (h *WebSocketHandler) ShaduleTurnTimeOut(currentRoom *room.Room, turnNumber int) {

	waitDuration := time.Until(currentRoom.Game.TurnEndsAt)
	if waitDuration <= 0 {
		return
	}
	go func() {
		time.Sleep(waitDuration)
		if currentRoom.Game == nil {

			return

		}

		if currentRoom.Game.Status == room.Wating {
			return
		}

		if currentRoom.Game.TurnNumber != turnNumber {
			return
		}

		h.EndDrawingTurn(currentRoom)
	}()

}

func (h *WebSocketHandler) EndDrawingTurn(currentRoom *room.Room) {
	if len(currentRoom.Players) == 0 {
		return
	}
	currentRoom.Game.Status = "turn_transition"

	// Resolve next drawer name
	currentIndex := currentRoom.Game.DrawerIndex
	nextIndex := (currentIndex + 1) % len(currentRoom.Players)
	nextDrawerNickname := "Someone"
	if nextDrawer, exists := h.sessionStore.GetByID(currentRoom.Players[nextIndex]); exists {
		nextDrawerNickname = nextDrawer.Nickname
	}

	// Reveal correct word in chat
	h.BroadcastChatMessage(currentRoom, protocol.ChatMessagePayload{
		PlayerId: "system",
		Nickname: "System",
		Message:  fmt.Sprintf("The word was: %s", currentRoom.Game.CurrentWord),
		Type:     "system",
	})

	// Broadcast EventTurnEnded to all players in the room
	payload := protocol.TurnEndedPayload{
		RoomCode:           currentRoom.Code,
		CorrectWord:        currentRoom.Game.CurrentWord,
		GainedPoints:       currentRoom.Game.TurnPoints,
		TotalScores:        currentRoom.Game.Scores,
		NextDrawerNickname: nextDrawerNickname,
		Duration:           8,
	}

	for _, playerId := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if !exists {
			continue
		}
		SendEnvelope(conn, protocol.EventTurnEnded, payload)
	}

	// Schedule turn transition timeout
	h.ShaduleTurnTransitionTimeOut(currentRoom, currentRoom.Game.TurnNumber)
}

func (h *WebSocketHandler) ShaduleTurnTransitionTimeOut(currentRoom *room.Room, turnNumber int) {
	go func() {
		time.Sleep(8 * time.Second)
		if currentRoom.Game == nil {
			return
		}
		if currentRoom.Game.Status != "turn_transition" {
			return
		}
		if currentRoom.Game.TurnNumber != turnNumber {
			return
		}
		h.AdvanceTurn(currentRoom)
	}()
}

func (h *WebSocketHandler) BroadcastChatMessage(currentRoom *room.Room, payload protocol.ChatMessagePayload) {
	for _, playerId := range currentRoom.Players {
		conn, exists := h.connStore.GetByPlayerID(playerId)
		if !exists {
			continue
		}
		SendEnvelope(conn, protocol.EventChatMessage, payload)
	}
}
