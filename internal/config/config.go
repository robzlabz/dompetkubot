package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration values loaded from environment variables.
type Config struct {
	TelegramToken     string
	TelegramBaseURL   string
	OpenAIAPIKey      string
	OpenAIBaseURL     string
	OpenAITimeout     time.Duration
	Model             string
	S3Region          string
	S3Bucket          string
	S3AccessKeyID     string
	S3SecretAccessKey string
	S3Endpoint        string
	S3UsePathStyle    bool
	LogLevel          string
}

// Load reads configuration from environment variables and applies reasonable defaults.
func Load() (*Config, error) {
	cfg := &Config{
		TelegramToken:     os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramBaseURL:   os.Getenv("TELEGRAM_BASE_URL"),
		OpenAIAPIKey:      os.Getenv("OPENAI_API_KEY"),
		OpenAIBaseURL:     os.Getenv("OPENAI_BASE_URL"),
		Model:             valueOrDefault(os.Getenv("OPENAI_MODEL"), "gpt-4o-mini"),
		S3Region:          os.Getenv("S3_REGION"),
		S3Bucket:          os.Getenv("S3_BUCKET"),
		S3AccessKeyID:     os.Getenv("S3_ACCESS_KEY_ID"),
		S3SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
		S3Endpoint:        os.Getenv("S3_ENDPOINT"),
		LogLevel:          valueOrDefault(os.Getenv("LOG_LEVEL"), "info"),
	}

	if cfg.TelegramToken == "" {
		return nil, fmt.Errorf("TELEGRAM_BOT_TOKEN is required")
	}
	if cfg.OpenAIAPIKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY is required")
	}
	if cfg.OpenAIBaseURL == "" {
		return nil, fmt.Errorf("OPENAI_BASE_URL is required")
	}

	if timeoutRaw := os.Getenv("OPENAI_TIMEOUT"); timeoutRaw != "" {
		timeout, err := time.ParseDuration(timeoutRaw)
		if err != nil {
			return nil, fmt.Errorf("invalid OPENAI_TIMEOUT: %w", err)
		}
		cfg.OpenAITimeout = timeout
	} else {
		cfg.OpenAITimeout = 30 * time.Second
	}

	if usePathStyle := os.Getenv("S3_USE_PATH_STYLE"); usePathStyle != "" {
		parsed, err := strconv.ParseBool(usePathStyle)
		if err != nil {
			return nil, fmt.Errorf("invalid S3_USE_PATH_STYLE: %w", err)
		}
		cfg.S3UsePathStyle = parsed
	}

	return cfg, nil
}

func valueOrDefault(value, def string) string {
	if value == "" {
		return def
	}
	return value
}
