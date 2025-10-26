package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/example/dompetkubot/internal/domain/entities"
	"github.com/example/dompetkubot/internal/domain/valueobjects"
)

// RecordTransactionInput holds the data required to create a new transaction.
type RecordTransactionInput struct {
	UserID      int64
	Category    string
	Description string
	Amount      float64
	Currency    string
	Type        entities.TransactionType
	MediaURLs   []string
	Timestamp   time.Time
}

// RecordTransactionUseCase handles the application logic for storing transactions.
type RecordTransactionUseCase struct {
	repo TransactionRepository
}

// NewRecordTransactionUseCase creates a new use case instance.
func NewRecordTransactionUseCase(repo TransactionRepository) *RecordTransactionUseCase {
	return &RecordTransactionUseCase{repo: repo}
}

// Execute creates and persists a new transaction entity.
func (uc *RecordTransactionUseCase) Execute(ctx context.Context, input RecordTransactionInput) (*entities.Transaction, error) {
	money, err := valueobjects.NewMoney(input.Amount, input.Currency)
	if err != nil {
		return nil, err
	}

	transaction := &entities.Transaction{
		ID:          uuid.NewString(),
		UserID:      input.UserID,
		Category:    input.Category,
		Description: input.Description,
		Money:       money,
		Type:        input.Type,
		Timestamp:   input.Timestamp,
		MediaURLs:   append([]string{}, input.MediaURLs...),
	}

	if transaction.Timestamp.IsZero() {
		transaction.Timestamp = time.Now().UTC()
	}

	if err := uc.repo.Save(ctx, transaction); err != nil {
		return nil, err
	}

	return transaction, nil
}
