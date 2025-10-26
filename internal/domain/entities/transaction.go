package entities

import (
	"time"

	"github.com/example/dompetkubot/internal/domain/valueobjects"
)

// TransactionType enumerates the type of a financial transaction.
type TransactionType string

const (
	// TransactionTypeExpense marks an expense.
	TransactionTypeExpense TransactionType = "expense"
	// TransactionTypeIncome marks an income.
	TransactionTypeIncome TransactionType = "income"
)

// Transaction represents a wallet transaction.
type Transaction struct {
	ID          string
	UserID      int64
	Category    string
	Description string
	Money       valueobjects.Money
	Type        TransactionType
	Timestamp   time.Time
	MediaURLs   []string
}
