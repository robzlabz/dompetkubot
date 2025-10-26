package valueobjects

import "fmt"

// Money represents a monetary amount with currency.
type Money struct {
	Amount   float64
	Currency string
}

// NewMoney creates a new Money value object ensuring the currency is present.
func NewMoney(amount float64, currency string) (Money, error) {
	if currency == "" {
		return Money{}, fmt.Errorf("currency is required")
	}
	return Money{Amount: amount, Currency: currency}, nil
}

// String returns a formatted string representation of the money.
func (m Money) String() string {
	return fmt.Sprintf("%.2f %s", m.Amount, m.Currency)
}
