package storage

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MemoryObjectStorage is a fallback MediaStorage storing objects in memory.
type MemoryObjectStorage struct {
	mu    sync.RWMutex
	items map[string][]byte
}

// NewMemoryObjectStorage creates a new in-memory object storage.
func NewMemoryObjectStorage() *MemoryObjectStorage {
	return &MemoryObjectStorage{items: make(map[string][]byte)}
}

// Save stores the payload in memory and returns a pseudo URL.
func (s *MemoryObjectStorage) Save(_ context.Context, key string, data []byte, _ string) (string, error) {
	if key == "" {
		key = fmt.Sprintf("memory/%d", time.Now().UnixNano())
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[key] = append([]byte{}, data...)
	return "memory://" + key, nil
}

// Data returns a snapshot of stored objects.
func (s *MemoryObjectStorage) Data() map[string][]byte {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string][]byte, len(s.items))
	for k, v := range s.items {
		out[k] = append([]byte{}, v...)
	}
	return out
}
