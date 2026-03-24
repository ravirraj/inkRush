package memory

import (
	"fmt"
	"sync"

	"github.com/ravirraj/inkRush/server/internal/domain/player"
)

type SessionStore struct {
	mu      sync.Mutex
	players map[string]*player.Player
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		players: make(map[string]*player.Player),
	}
}

func (s *SessionStore) Add(player *player.Player) {

	s.mu.Lock()
	s.players[player.Id] = player
	s.mu.Unlock()
	fmt.Println("Player Added To Store", s.players)
}

func (s *SessionStore) GetByID(playerId string) (*player.Player, bool) {

	// if player, exists := s.players[playerId];
	//  exists {
	// 	fmt.Println("Player ", player)
	// 	return player,exists
	// } else {
	// 	fmt.Println("Player is not in the session")
	// }

	// return nil,
	s.mu.Lock()
	player, exists := s.players[playerId]
	s.mu.Unlock()
	return player, exists
}
