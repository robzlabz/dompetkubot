import { env } from '../config/environment.js';
import OpenAI from 'openai';

export interface STTResult {
  success: boolean;
  text?: string;
  error?: string;
  duration?: number;
  language?: string;
}

export interface AudioFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export class SpeechToTextService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  /**
   * Transcribe audio file to text using OpenAI Whisper
   */
  async transcribeAudio(audioFile: AudioFile): Promise<STTResult> {
    try {
      console.log(`Transcribing audio file: ${audioFile.filename} (${audioFile.buffer.length} bytes)`);

      // Create a File-like object from buffer
      const file = new File([new Uint8Array(audioFile.buffer)], audioFile.filename, {
        type: audioFile.mimeType,
      });

      // Use OpenAI Whisper API for transcription
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'id', // Indonesian language
        response_format: 'json',
        temperature: 0.2, // Lower temperature for more consistent results
      });

      const text = transcription.text?.trim();
      
      if (!text) {
        return {
          success: false,
          error: 'No text could be transcribed from the audio',
        };
      }

      console.log(`Transcription successful: "${text}"`);

      return {
        success: true,
        text,
        language: 'id', // Default to Indonesian
      };
    } catch (error) {
      console.error('Speech-to-text error:', error);
      
      let errorMessage = 'Failed to transcribe audio';
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded for speech recognition';
        } else if (error.message.includes('quota')) {
          errorMessage = 'Speech recognition quota exceeded';
        } else if (error.message.includes('invalid')) {
          errorMessage = 'Invalid audio format';
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if audio format is supported
   */
  isSupportedFormat(mimeType: string): boolean {
    const supportedFormats = [
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
    ];

    return supportedFormats.includes(mimeType);
  }

  /**
   * Get estimated cost for transcription (in coins)
   * Based on audio duration and OpenAI pricing
   */
  getTranscriptionCost(durationSeconds: number): number {
    // Base cost: 0.5 coins per voice message
    // Additional cost for longer messages (>30 seconds): +0.1 coins per 30s
    const baseCost = 0.5;
    const additionalCost = Math.max(0, Math.ceil((durationSeconds - 30) / 30) * 0.1);
    
    return baseCost + additionalCost;
  }

  /**
   * Validate audio file before processing
   */
  validateAudioFile(audioFile: AudioFile): { valid: boolean; error?: string } {
    // Check file size (max 25MB for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.buffer.length > maxSize) {
      return {
        valid: false,
        error: 'Audio file too large (max 25MB)',
      };
    }

    // Check if format is supported
    if (!this.isSupportedFormat(audioFile.mimeType)) {
      return {
        valid: false,
        error: `Unsupported audio format: ${audioFile.mimeType}`,
      };
    }

    return { valid: true };
  }
}