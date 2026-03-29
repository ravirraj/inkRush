package memory

import (
	"sync"

	"github.com/gorilla/websocket"
)

type ConnStore struct {
	mu   sync.Mutex
	conn map[string]*websocket.Conn
}

func NewConnectionStore() *ConnStore {
	return &ConnStore{
		conn: make(map[string]*websocket.Conn),
	}
}

func (c *ConnStore) Add(playerID string, conn *websocket.Conn) {
	c.mu.Lock()
	c.conn[playerID] = conn
	c.mu.Unlock()
}

func (c *ConnStore) GetByPlayerID(playerID string) (*websocket.Conn, bool) {
	c.mu.Lock()
	conn, exists := c.conn[playerID]
	c.mu.Unlock()
	return conn, exists
}

func (c *ConnStore) Remove(playerID string) {
	c.mu.Lock()
	delete(c.conn, playerID)
	c.mu.Unlock()

}
