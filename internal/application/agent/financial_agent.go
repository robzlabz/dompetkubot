package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/example/dompetkubot/internal/application/usecase"
	"github.com/example/dompetkubot/internal/domain/entities"
	"github.com/example/dompetkubot/internal/infrastructure/ai"
)

// FinancialAgent orchestrates reasoning with the LLM and calling the transaction use cases.
type FinancialAgent struct {
	openAI        *ai.OpenAIClient
	recordUseCase *usecase.RecordTransactionUseCase
}

// NewFinancialAgent builds a new agent instance.
func NewFinancialAgent(openAI *ai.OpenAIClient, recordUseCase *usecase.RecordTransactionUseCase) *FinancialAgent {
	return &FinancialAgent{openAI: openAI, recordUseCase: recordUseCase}
}

// ConversationResult is returned after the agent finishes processing a message.
type ConversationResult struct {
	Reply    string
	Recorded *entities.Transaction
}

// HandleMessage processes the incoming message, asking the LLM to reason about it and optionally recording a transaction.
func (a *FinancialAgent) HandleMessage(ctx context.Context, userID int64, text string, mediaURLs []string) (*ConversationResult, error) {
	messages := []ai.ChatMessage{
		{Role: "system", Content: "You are DompetkuBot, a helpful Indonesian financial assistant. Extract structured financial transactions when appropriate."},
		{Role: "user", Content: text},
	}

	toolSchema := json.RawMessage(`{
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": ["income", "expense"]},
            "amount": {"type": "number"},
            "currency": {"type": "string"},
            "category": {"type": "string"},
            "description": {"type": "string"}
        },
        "required": ["type", "amount", "currency"]
    }`)

	tools := []ai.Tool{
		ai.NewFunctionTool("record_transaction", "Record a structured financial transaction extracted from the conversation", toolSchema),
	}

	completion, err := a.openAI.ChatCompletion(ctx, messages, tools)
	if err != nil {
		return nil, err
	}
	if len(completion.Choices) == 0 {
		return nil, errors.New("no choices returned")
	}

	choice := completion.Choices[0]
	result := &ConversationResult{Reply: choice.Message.Content}

	if len(choice.ToolCalls) > 0 {
		for _, call := range choice.ToolCalls {
			if call.Function.Name == "record_transaction" {
				var payload struct {
					Type        string  `json:"type"`
					Amount      float64 `json:"amount"`
					Currency    string  `json:"currency"`
					Category    string  `json:"category"`
					Description string  `json:"description"`
				}
				if err := json.Unmarshal(call.Function.Arguments, &payload); err != nil {
					return nil, fmt.Errorf("invalid tool arguments: %w", err)
				}

				txType := entities.TransactionTypeExpense
				if payload.Type == string(entities.TransactionTypeIncome) {
					txType = entities.TransactionTypeIncome
				}

				tx, err := a.recordUseCase.Execute(ctx, usecase.RecordTransactionInput{
					UserID:      userID,
					Category:    payload.Category,
					Description: payload.Description,
					Amount:      payload.Amount,
					Currency:    payload.Currency,
					Type:        txType,
					MediaURLs:   mediaURLs,
					Timestamp:   time.Now().UTC(),
				})
				if err != nil {
					return nil, err
				}
				result.Recorded = tx
			}
		}
	}

	if result.Reply == "" && result.Recorded != nil {
		result.Reply = fmt.Sprintf("Pencatatan %s sebesar %.2f %s berhasil.", result.Recorded.Type, result.Recorded.Money.Amount, result.Recorded.Money.Currency)
	}

	if result.Reply == "" {
		result.Reply = "Maaf, saya tidak dapat memahami permintaan Anda."
	}

	return result, nil
}
