package storage

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
	"path"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Storage uploads binary data to an S3-compatible object storage.
type S3Storage struct {
	bucket   string
	client   *s3.Client
	uploader *manager.Uploader
	baseURL  *url.URL
}

// S3Config holds configuration details for the S3 storage adapter.
type S3Config struct {
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	Endpoint        string
	UsePathStyle    bool
}

// NewS3Storage constructs an S3Storage adapter.
func NewS3Storage(ctx context.Context, cfg S3Config) (*S3Storage, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("bucket is required")
	}

	loadOpts := []func(*config.LoadOptions) error{
		config.WithRegion(cfg.Region),
	}
	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		loadOpts = append(loadOpts, config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")))
	}
	if cfg.Endpoint != "" {
		loadOpts = append(loadOpts, config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{URL: cfg.Endpoint, HostnameImmutable: true}, nil
		})))
	}

	awsCfg, err := config.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle
	})

	var baseURL *url.URL
	if cfg.Endpoint != "" {
		if parsed, err := url.Parse(cfg.Endpoint); err == nil {
			baseURL = parsed
		}
	}

	return &S3Storage{
		bucket:   cfg.Bucket,
		client:   client,
		uploader: manager.NewUploader(client),
		baseURL:  baseURL,
	}, nil
}

// Save stores the payload to S3 and returns the resulting object URL.
func (s *S3Storage) Save(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	if key == "" {
		key = fmt.Sprintf("uploads/%d", time.Now().UnixNano())
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	}

	_, err := s.uploader.Upload(ctx, input)
	if err != nil {
		return "", err
	}

	if s.baseURL != nil {
		u := *s.baseURL
		u.Path = path.Join(u.Path, s.bucket, key)
		return u.String(), nil
	}

	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.client.Region, key), nil
}
