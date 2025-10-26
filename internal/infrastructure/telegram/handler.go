package telegram

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"strings"

	tg "github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"github.com/example/dompetkubot/internal/application/agent"
	"github.com/example/dompetkubot/internal/pkg/logging"
)

// Bot wraps the Telegram bot infrastructure adapter.
type Bot struct {
	client       *tg.Bot
	mediaStorage agent.MediaStorage
	agent        *agent.FinancialAgent
	logger       *slog.Logger
}

// Config holds configuration for the telegram adapter.
type Config struct {
	Token   string
	BaseURL string
}

// NewBot builds a telegram Bot adapter.
func NewBot(ctx context.Context, cfg Config, botAgent *agent.FinancialAgent, mediaStorage agent.MediaStorage, logger *slog.Logger) (*Bot, error) {
	opts := []tg.Option{}
	if cfg.BaseURL != "" {
		opts = append(opts, tg.WithBaseURL(cfg.BaseURL))
	}

	client, err := tg.New(cfg.Token, opts...)
	if err != nil {
		return nil, err
	}

	adapter := &Bot{client: client, mediaStorage: mediaStorage, agent: botAgent, logger: logger}

	client.RegisterHandler(tg.HandlerTypeMessageText, "", adapter.handleText)
	client.RegisterHandler(tg.HandlerTypeMessage, "", adapter.handleMessage)

	go client.Start(ctx)
	return adapter, nil
}

func (b *Bot) handleText(ctx context.Context, bot *tg.Bot, update *models.Update) {
	b.process(ctx, bot, update)
}

func (b *Bot) handleMessage(ctx context.Context, bot *tg.Bot, update *models.Update) {
	if update.Message != nil && update.Message.Text != "" {
		return
	}
	b.process(ctx, bot, update)
}

func (b *Bot) process(ctx context.Context, bot *tg.Bot, update *models.Update) {
	msg := update.Message
	if msg == nil {
		return
	}

	ctx = logging.WithContext(ctx, b.logger)
	logger := logging.FromContext(ctx)

	var mediaURLs []string
	if msg.Voice != nil {
		if url, err := b.downloadAndStore(ctx, bot, msg.Voice.FileID, "voice.ogg"); err == nil {
			mediaURLs = append(mediaURLs, url)
		} else {
			logger.Error("failed to store voice", "error", err)
		}
	}

	if len(msg.Photo) > 0 {
		photo := msg.Photo[len(msg.Photo)-1]
		if url, err := b.downloadAndStore(ctx, bot, photo.FileID, "photo.jpg"); err == nil {
			mediaURLs = append(mediaURLs, url)
		} else {
			logger.Error("failed to store photo", "error", err)
		}
	}

	text := strings.TrimSpace(msg.Text)
	if text == "" {
		text = strings.TrimSpace(msg.Caption)
	}
	if text == "" {
		text = "Pengguna mengirimkan lampiran."
	}

	result, err := b.agent.HandleMessage(ctx, msg.Chat.ID, text, mediaURLs)
	if err != nil {
		logger.Error("agent failed", "error", err)
		_, _ = bot.SendMessage(ctx, &tg.SendMessageParams{ChatID: msg.Chat.ID, Text: "Terjadi kesalahan saat memproses pesan."})
		return
	}

	responseText := result.Reply
	if result.Recorded != nil {
		responseText = fmt.Sprintf("%s\n\nKategori: %s\nJumlah: %.2f %s", responseText, result.Recorded.Category, result.Recorded.Money.Amount, result.Recorded.Money.Currency)
	}

	if len(mediaURLs) > 0 {
		responseText += "\nLampiran disimpan:"
		for _, url := range mediaURLs {
			responseText += "\n" + url
		}
	}

	_, err = bot.SendMessage(ctx, &tg.SendMessageParams{ChatID: msg.Chat.ID, Text: responseText})
	if err != nil {
		logger.Error("failed to send message", "error", err)
	}
}

func (b *Bot) downloadAndStore(ctx context.Context, bot *tg.Bot, fileID, fallbackName string) (string, error) {
	file, err := bot.GetFile(ctx, &tg.GetFileParams{FileID: fileID})
	if err != nil {
		return "", err
	}

	downloadURL := fmt.Sprintf("%s/file/bot%s/%s", bot.URL(), bot.Token(), file.FilePath)
	rc, err := httpGet(ctx, downloadURL)
	if err != nil {
		return "", err
	}
	defer rc.Close()

	data, err := io.ReadAll(rc)
	if err != nil {
		return "", err
	}

	contentType := mime.TypeByExtension(path.Ext(file.FilePath))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	key := file.FilePath
	if key == "" {
		key = fallbackName
	}

	return b.mediaStorage.Save(ctx, key, data, contentType)
}

// httpGet allows mocking in tests.
var httpGet = func(ctx context.Context, rawURL string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= http.StatusBadRequest {
		resp.Body.Close()
		return nil, fmt.Errorf("telegram download failed: %s", resp.Status)
	}

	return resp.Body, nil
}
