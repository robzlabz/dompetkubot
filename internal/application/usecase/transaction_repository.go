package usecase

import (
	"context"

	"github.com/example/dompetkubot/internal/domain/entities"
)

// TransactionRepository defines the persistence port for transactions.
type TransactionRepository interface {
	Save(ctx context.Context, transaction *entities.Transaction) error
}
