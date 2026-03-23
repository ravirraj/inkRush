package protocol

import "encoding/json"

type Envelope struct {
	Type    string          `json:"type"`
	PayLoad json.RawMessage `json:"payload"`
}
