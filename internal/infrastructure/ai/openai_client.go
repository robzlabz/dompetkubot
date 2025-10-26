package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ChatMessage represents a chat completion message.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ToolCall represents a tool invocation proposed by the model.
type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

// ToolCallFunction describes the function call proposed by the model.
type ToolCallFunction struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// Tool models a callable function exposed to the LLM.
type Tool struct {
	Type     string        `json:"type"`
	Function *FunctionTool `json:"function,omitempty"`
}

// FunctionTool describes a function tool.
type FunctionTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// ChatCompletionRequest models the OpenAI chat completion request payload.
type ChatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float32       `json:"temperature,omitempty"`
	Tools       []Tool        `json:"tools,omitempty"`
}

// ChatCompletionResponse models the OpenAI chat completion response payload.
type ChatCompletionResponse struct {
	Choices []struct {
		Message      ChatMessage `json:"message"`
		FinishReason string      `json:"finish_reason"`
		ToolCalls    []ToolCall  `json:"tool_calls"`
	} `json:"choices"`
}

// NewFunctionTool constructs a new function tool definition.
func NewFunctionTool(name, description string, parameters json.RawMessage) Tool {
	return Tool{
		Type: "function",
		Function: &FunctionTool{
			Name:        name,
			Description: description,
			Parameters:  parameters,
		},
	}
}

// OpenAIClient is a minimal client for the OpenAI API.
type OpenAIClient struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
}

// NewOpenAIClient builds a new OpenAIClient.
func NewOpenAIClient(baseURL, apiKey, model string, timeout time.Duration) *OpenAIClient {
	return &OpenAIClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		model:   model,
		client:  &http.Client{Timeout: timeout},
	}
}

// ChatCompletion requests a completion from the OpenAI chat completions API.
func (c *OpenAIClient) ChatCompletion(ctx context.Context, messages []ChatMessage, tools []Tool) (*ChatCompletionResponse, error) {
	payload := ChatCompletionRequest{
		Model:    c.model,
		Messages: messages,
		Tools:    tools,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v1/chat/completions", c.baseURL), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("openai error: %s", resp.Status)
	}

	var completion ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&completion); err != nil {
		return nil, err
	}
	return &completion, nil
}
