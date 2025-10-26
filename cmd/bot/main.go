package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/example/dompetkubot/internal/application/agent"
	"github.com/example/dompetkubot/internal/application/usecase"
	"github.com/example/dompetkubot/internal/config"
	"github.com/example/dompetkubot/internal/infrastructure/ai"
	"github.com/example/dompetkubot/internal/infrastructure/storage"
	"github.com/example/dompetkubot/internal/infrastructure/telegram"
	"github.com/example/dompetkubot/internal/pkg/logging"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	logger := logging.New(cfg.LogLevel)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	openAI := ai.NewOpenAIClient(cfg.OpenAIBaseURL, cfg.OpenAIAPIKey, cfg.Model, cfg.OpenAITimeout)

	repo := storage.NewMemoryTransactionRepository()
	recordUC := usecase.NewRecordTransactionUseCase(repo)

	var mediaStorage agent.MediaStorage
	if cfg.S3Bucket != "" {
		mediaStorage, err = storage.NewS3Storage(ctx, storage.S3Config{
			Region:          cfg.S3Region,
			Bucket:          cfg.S3Bucket,
			AccessKeyID:     cfg.S3AccessKeyID,
			SecretAccessKey: cfg.S3SecretAccessKey,
			Endpoint:        cfg.S3Endpoint,
			UsePathStyle:    cfg.S3UsePathStyle,
		})
		if err != nil {
			log.Fatalf("failed to init s3 storage: %v", err)
		}
	} else {
		mediaStorage = storage.NewMemoryObjectStorage()
	}

	botAgent := agent.NewFinancialAgent(openAI, recordUC)

	_, err = telegram.NewBot(ctx, telegram.Config{Token: cfg.TelegramToken, BaseURL: cfg.TelegramBaseURL}, botAgent, mediaStorage, logger)
	if err != nil {
		log.Fatalf("failed to start telegram bot: %v", err)
	}

	logger.Info("bot started")

	<-ctx.Done()
	logger.Info("shutting down")

	time.Sleep(1 * time.Second)
}
