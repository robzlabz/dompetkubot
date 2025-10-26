package agent

import "context"

// MediaStorage defines the port for storing binary media assets.
type MediaStorage interface {
	Save(ctx context.Context, key string, data []byte, contentType string) (string, error)
}
