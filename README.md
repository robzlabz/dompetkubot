# DompetkuBot (Go Edition)

DompetkuBot adalah bot Telegram untuk pencatatan keuangan personal dengan pendekatan arsitektur heksagonal dan memanfaatkan model `gpt-4o-mini` melalui OpenAI API dengan basis URL kustom.

## Fitur Utama

- 🤖 Agentic bot yang mampu mengekstrak transaksi keuangan dari bahasa alami pengguna.
- 🧱 Arsitektur heksagonal dengan pemisahan domain, aplikasi, dan infrastruktur.
- 📡 Integrasi dengan [go-telegram/bot](https://github.com/go-telegram/bot).
- 🧠 Integrasi OpenAI Chat Completions dengan dukungan basis URL kustom.
- ☁️ Penyimpanan media pada layanan S3 (atau fallback in-memory untuk pengembangan).

## Struktur Proyek

```
cmd/bot              # Entrypoint aplikasi
internal/
  application/       # Agent, use case, dan port
  config/            # Loader konfigurasi
  domain/            # Entitas dan value object
  infrastructure/    # Adapter (AI, Telegram, Storage)
  pkg/logging/       # Utilitas logging
```

## Konfigurasi

Set variabel lingkungan berikut sebelum menjalankan bot:

| Variabel | Keterangan |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram. |
| `TELEGRAM_BASE_URL` | Opsional. Basis URL API Telegram kustom. |
| `OPENAI_API_KEY` | Kunci API untuk layanan OpenAI kompatibel. |
| `OPENAI_BASE_URL` | Basis URL endpoint OpenAI (mis. `https://api.openai.com`). |
| `OPENAI_MODEL` | Opsional, default `gpt-4o-mini`. |
| `OPENAI_TIMEOUT` | Opsional, durasi timeout, default `30s`. |
| `S3_BUCKET` | Nama bucket S3 untuk menyimpan media. Jika kosong akan fallback ke penyimpanan memory. |
| `S3_REGION` | Region bucket S3. |
| `S3_ACCESS_KEY_ID` | Opsional, kredensial akses. |
| `S3_SECRET_ACCESS_KEY` | Opsional, kredensial akses. |
| `S3_ENDPOINT` | Opsional, endpoint S3 kustom (mis. MinIO). |
| `S3_USE_PATH_STYLE` | Opsional, gunakan path-style addressing (`true/false`). |
| `LOG_LEVEL` | Opsional, level log (`debug`, `info`, `warn`, `error`). |

## Menjalankan Bot

```bash
go mod tidy
go run ./cmd/bot
```

Bot akan terus berjalan hingga menerima sinyal `SIGINT`/`SIGTERM`.

## Lisensi

MIT
