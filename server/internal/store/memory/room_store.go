package memory

import (
	"sync"

	"github.com/ravirraj/inkRush/server/internal/domain/room"
	// randomid "github.com/ravirraj/inkRush/server/internal/pkg/RandomID"
)

type RoomStore struct {
	mu    sync.Mutex
	rooms map[string]*room.Room
}

func NewRoomStore() *RoomStore {
	return &RoomStore{rooms: make(map[string]*room.Room)}
}

func (r *RoomStore) Add(room *room.Room) {

	// id := randomid.GenerateID(6)
	r.mu.Lock()
	r.rooms[room.Code] = room
	r.mu.Unlock()
}

func (r *RoomStore) GetByCode(roomCode string) (*room.Room, bool) {
	r.mu.Lock()
	value, exists := r.rooms[roomCode]
	r.mu.Unlock()
	return value, exists

}

func (r *RoomStore) Remove(roomId string) {
	r.mu.Lock()
	delete(r.rooms, roomId)
	r.mu.Unlock()
}
