package storage

import (
	"context"
	"sync"

	"github.com/example/dompetkubot/internal/domain/entities"
)

// MemoryTransactionRepository is an in-memory implementation of the TransactionRepository port.
type MemoryTransactionRepository struct {
	mu           sync.RWMutex
	transactions []*entities.Transaction
}

// NewMemoryTransactionRepository creates a new in-memory repository instance.
func NewMemoryTransactionRepository() *MemoryTransactionRepository {
	return &MemoryTransactionRepository{}
}

// Save stores the transaction in memory.
func (r *MemoryTransactionRepository) Save(_ context.Context, transaction *entities.Transaction) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.transactions = append(r.transactions, transaction)
	return nil
}

// List returns a snapshot of the stored transactions.
func (r *MemoryTransactionRepository) List() []*entities.Transaction {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cp := make([]*entities.Transaction, len(r.transactions))
	copy(cp, r.transactions)
	return cp
}
