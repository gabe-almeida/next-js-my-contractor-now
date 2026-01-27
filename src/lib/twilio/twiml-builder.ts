/**
 * WHY: Standardized TwiML generation for consistent call handling.
 * WHEN: Called by webhook handlers to generate call flow instructions.
 * HOW: Uses Twilio VoiceResponse class with typed options.
 */

import { twiml } from 'twilio';
import { logTwimlGenerated } from './logging';

// Default voice configuration for consistency
// Using Amazon Polly voice for natural sounding speech
const DEFAULT_VOICE = 'Polly.Joanna' as const;

/**
 * WHY: Twilio-hosted hold music URLs are more reliable than external sources.
 * WHEN: Caller is waiting during auction or transfer.
 *
 * These are official Twilio-hosted audio files that won't time out.
 * @see https://www.twilio.com/docs/voice/twiml/play#attributes
 */
const TWILIO_HOLD_MUSIC = {
  // Classic hold music - smooth jazz style
  classic: 'https://api.twilio.com/cowbell.mp3',
  // Soft piano music - professional and calming
  soft: 'http://com.twilio.music.soft-rock.s3.amazonaws.com/_ghost_-_promo_-_kicking_it_up_a_notch_64kb.mp3',
  // Classical music - elegant
  classical: 'http://com.twilio.music.classical.s3.amazonaws.com/ith_chopin-702702.mp3',
  // Electronic/ambient - modern feel
  electronic: 'http://com.twilio.music.electronica.s3.amazonaws.com/ith_worldahead-702766.mp3',
  // Upbeat rock - energetic
  rock: 'http://com.twilio.music.rock.s3.amazonaws.com/nickleus_-_original_guitar_song_64kb.mp3',
} as const;

// Default to soft rock for professional contractor service
const DEFAULT_HOLD_MUSIC = TWILIO_HOLD_MUSIC.soft;

/**
 * Options for IVR gather prompts
 */
export interface IvrGatherOptions {
  numDigits?: number;
  timeout?: number;
  finishOnKey?: string;
  voice?: string;
}

/**
 * Build IVR gather prompt
 * @param prompt The text to speak to the caller
 * @param actionUrl URL to receive the gather results
 * @param options Additional gather configuration
 * @returns TwiML string
 */
export function buildIvrGather(
  prompt: string,
  actionUrl: string,
  options: IvrGatherOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  const gather = response.gather({
    action: actionUrl,
    method: 'POST',
    numDigits: options.numDigits || 1,
    timeout: options.timeout || 10,
    finishOnKey: options.finishOnKey || '#',
  });
  gather.say({ voice }, prompt);

  // Fallback if no input received
  response.say({ voice }, "We didn't receive a response. Goodbye.");
  response.hangup();

  const twimlString = response.toString();
  logTwimlGenerated({
    twimlType: 'ivrGather',
    twiml: twimlString,
  });

  return twimlString;
}

// ============================================
// SPEECH INPUT SUPPORT (P3-IVR-4)
// ============================================

/**
 * Speech recognition model options
 */
export type SpeechModel = 'default' | 'phone_call' | 'numbers_and_commands';

/**
 * Extended options for IVR gather with speech support
 */
export interface SpeechGatherOptions extends IvrGatherOptions {
  /** Input type: 'dtmf', 'speech', or 'dtmf speech' */
  inputType?: 'dtmf' | 'speech' | 'dtmf speech';
  /** Speech recognition model */
  speechModel?: SpeechModel;
  /** Speech timeout ('auto' or seconds as string) */
  speechTimeout?: string;
  /** Hints for speech recognition (e.g., ZIP codes, yes/no) */
  hints?: string[];
  /** Language for speech recognition (e.g., 'en-US') */
  language?: string;
  /** Profanity filter (default: true) */
  profanityFilter?: boolean;
  /** Enhanced recognition for certain inputs */
  enhanced?: boolean;
}

/**
 * WHY: Build IVR gather with speech recognition support.
 * WHEN: Used for voice input collection (ZIP codes, yes/no responses).
 * HOW: Configures Twilio's speech-to-text with appropriate hints.
 *
 * @param prompt - Text to speak before gathering input
 * @param actionUrl - URL to receive the gather results
 * @param options - Speech and gather configuration
 * @returns TwiML string
 */
export function buildSpeechGather(
  prompt: string,
  actionUrl: string,
  options: SpeechGatherOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  const gatherOptions: Record<string, unknown> = {
    action: actionUrl,
    method: 'POST',
    timeout: options.timeout || 10,
  };

  // Configure input type
  if (options.inputType) {
    gatherOptions.input = options.inputType;
  } else {
    gatherOptions.input = 'dtmf'; // Default to DTMF only
  }

  // DTMF-specific options
  if (options.inputType === 'dtmf' || !options.inputType) {
    if (options.numDigits) {
      gatherOptions.numDigits = options.numDigits;
    }
    if (options.finishOnKey) {
      gatherOptions.finishOnKey = options.finishOnKey;
    }
  }

  // Speech-specific options
  if (options.inputType === 'speech' || options.inputType === 'dtmf speech') {
    // Speech model for better recognition
    if (options.speechModel) {
      gatherOptions.speechModel = options.speechModel;
    }

    // Speech timeout
    if (options.speechTimeout) {
      gatherOptions.speechTimeout = options.speechTimeout;
    }

    // Hints improve recognition accuracy
    if (options.hints && options.hints.length > 0) {
      gatherOptions.hints = options.hints.join(', ');
    }

    // Language
    if (options.language) {
      gatherOptions.language = options.language;
    }

    // Profanity filter
    if (options.profanityFilter !== undefined) {
      gatherOptions.profanityFilter = options.profanityFilter;
    }

    // Enhanced recognition
    if (options.enhanced) {
      gatherOptions.enhanced = options.enhanced;
    }
  }

  const gather = response.gather(gatherOptions);
  gather.say({ voice }, prompt);

  // Fallback if no input received
  response.say({ voice }, "We didn't receive a response. Goodbye.");
  response.hangup();

  const twimlString = response.toString();
  logTwimlGenerated({
    twimlType: 'speechGather',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * WHY: Build gather optimized for ZIP code collection via speech.
 * WHEN: Caller needs to provide their ZIP code by voice.
 * HOW: Uses numbers_and_commands model with digit hints.
 *
 * @param prompt - Text prompt (e.g., "Please say or enter your 5-digit ZIP code")
 * @param actionUrl - URL to receive results
 * @param options - Additional options
 * @returns TwiML string
 */
export function buildZipCodeGather(
  prompt: string,
  actionUrl: string,
  options: Partial<SpeechGatherOptions> = {}
): string {
  // Generate ZIP code hints (common patterns)
  const zipHints = [
    // Single digits
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // Common prefixes
    '100', '200', '300', '400', '500', '600', '700', '800', '900',
    // Spelled out numbers
    'zero', 'one', 'two', 'three', 'four', 'five',
    'six', 'seven', 'eight', 'nine',
  ];

  return buildSpeechGather(prompt, actionUrl, {
    inputType: 'dtmf speech',
    numDigits: 5,
    finishOnKey: '#',
    speechModel: 'numbers_and_commands',
    speechTimeout: 'auto',
    hints: [...zipHints, ...(options.hints || [])],
    timeout: options.timeout || 15,
    voice: options.voice,
    language: options.language || 'en-US',
  });
}

/**
 * WHY: Build gather optimized for yes/no responses.
 * WHEN: Caller needs to confirm something (homeowner, appointment).
 * HOW: Uses speech with yes/no hints and DTMF 1/2 fallback.
 *
 * @param prompt - Text prompt
 * @param actionUrl - URL to receive results
 * @param options - Additional options
 * @returns TwiML string
 */
export function buildYesNoGather(
  prompt: string,
  actionUrl: string,
  options: Partial<SpeechGatherOptions> = {}
): string {
  const yesNoHints = [
    'yes', 'no', 'yeah', 'nope', 'yep', 'nah',
    'correct', 'incorrect', 'right', 'wrong',
    'affirmative', 'negative',
    'one', 'two', '1', '2',
  ];

  return buildSpeechGather(prompt, actionUrl, {
    inputType: 'dtmf speech',
    numDigits: 1,
    speechModel: 'phone_call',
    speechTimeout: 'auto',
    hints: [...yesNoHints, ...(options.hints || [])],
    timeout: options.timeout || 10,
    voice: options.voice,
    language: options.language || 'en-US',
  });
}

// ============================================
// EXISTING FUNCTIONS
// ============================================

/**
 * Options for call transfer
 */
export interface TransferOptions {
  record?: boolean;
  timeout?: number;
  callId?: string;
}

/**
 * Build call transfer with optional recording
 * @param phoneNumber The phone number to transfer to
 * @param callerId The caller ID to display (usually the original caller)
 * @param callbackUrl URL to receive dial results
 * @param options Additional transfer configuration
 * @returns TwiML string
 */
export function buildTransfer(
  phoneNumber: string,
  callerId: string,
  callbackUrl: string,
  options: TransferOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

  // Base dial attributes
  const dialAttributes: Record<string, unknown> = {
    callerId,
    action: callbackUrl,
    method: 'POST',
    timeout: options.timeout || 30,
  };

  // Add recording configuration if requested
  if (options.record) {
    dialAttributes.record = 'record-from-ringing-dual';
    dialAttributes.recordingStatusCallback = `${baseUrl}/api/calls/recording`;
    dialAttributes.recordingStatusCallbackMethod = 'POST';
    dialAttributes.recordingStatusCallbackEvent = 'completed';
  }

  const dial = response.dial(dialAttributes);
  dial.number(phoneNumber);

  const twimlString = response.toString();
  logTwimlGenerated({
    callId: options.callId,
    twimlType: 'transfer',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for hold music
 */
export interface HoldMusicOptions {
  musicUrl?: string;
  maxWaitSeconds?: number;
  voice?: string;
  musicStyle?: keyof typeof TWILIO_HOLD_MUSIC;
}

/**
 * Build hold music while auction runs
 * @param message Message to play before hold music
 * @param options Additional hold music configuration
 * @returns TwiML string
 */
export function buildHoldMusic(
  message: string,
  options: HoldMusicOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  response.say({ voice }, message);

  // Get music URL from options or use default
  const musicUrl = options.musicUrl ||
    (options.musicStyle ? TWILIO_HOLD_MUSIC[options.musicStyle] : DEFAULT_HOLD_MUSIC);

  response.play({ loop: 0 }, musicUrl);

  const twimlString = response.toString();
  logTwimlGenerated({
    twimlType: 'holdMusic',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for auction hold experience
 */
export interface AuctionHoldOptions {
  /** Message to play while waiting */
  message?: string;
  /** Music style to use during hold */
  musicStyle?: keyof typeof TWILIO_HOLD_MUSIC;
  /** Custom music URL (overrides musicStyle) */
  musicUrl?: string;
  /** Voice to use for message */
  voice?: string;
  /** Call ID for tracking */
  callId?: string;
}

/**
 * WHY: Build hold experience for auction wait time.
 * WHEN: Caller is waiting while auction runs (typically 2-3 seconds).
 * HOW: Play brief message, then short music loop, then redirect to auction result.
 *
 * DESIGN: The auction runs asynchronously. When it completes, it updates the call record.
 *         The redirect URL polls for auction completion and returns transfer TwiML.
 *
 * @param auctionUrl - URL to redirect to after hold music
 * @param options - Configuration options
 * @returns TwiML string with hold experience
 */
export function buildAuctionHold(
  auctionUrl: string,
  options: AuctionHoldOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  // Play brief hold message
  const message = options.message || 'Please hold while we connect you with a specialist.';
  response.say({ voice }, message);

  // Short pause to let caller settle
  response.pause({ length: 1 });

  // Redirect to auction endpoint (auction runs and returns transfer TwiML)
  response.redirect({ method: 'POST' }, auctionUrl);

  const twimlString = response.toString();
  logTwimlGenerated({
    callId: options.callId,
    twimlType: 'auctionHold',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for optimized auction hold
 */
export interface OptimizedHoldOptions {
  /** Message to play while waiting */
  message?: string;
  /** Voice to use for message */
  voice?: string;
  /** Call ID for tracking */
  callId?: string;
  /** Maximum hold time in seconds before timeout */
  maxHoldSeconds?: number;
}

/**
 * WHY: Build optimized hold experience for fast auctions (< 3 seconds).
 * WHEN: Auction is expected to complete quickly with local contractors.
 * HOW: Brief message only, no music (music adds latency).
 *
 * PERFORMANCE: For fast auctions, we skip music to reduce latency.
 *              The message provides enough time for auction to complete.
 *
 * @param auctionUrl - URL to redirect to after message
 * @param options - Configuration options
 * @returns TwiML string with optimized hold
 */
export function buildOptimizedHold(
  auctionUrl: string,
  options: OptimizedHoldOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  // Play brief hold message (while auction runs in parallel on redirect)
  const message = options.message ||
    'Please hold while we connect you with a local specialist.';
  response.say({ voice }, message);

  // Redirect immediately to auction (no music = faster response)
  response.redirect({ method: 'POST' }, auctionUrl);

  const twimlString = response.toString();
  logTwimlGenerated({
    callId: options.callId,
    twimlType: 'optimizedHold',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for hold with music during longer waits
 */
export interface LongHoldOptions {
  /** Initial message to play */
  initialMessage?: string;
  /** Periodic message to play */
  periodicMessage?: string;
  /** Voice to use */
  voice?: string;
  /** Music style */
  musicStyle?: keyof typeof TWILIO_HOLD_MUSIC;
  /** Custom music URL */
  musicUrl?: string;
  /** Call ID for tracking */
  callId?: string;
  /** Seconds between periodic messages */
  messageIntervalSeconds?: number;
  /** Maximum hold time before redirect */
  maxHoldSeconds?: number;
}

/**
 * WHY: Build extended hold experience for network PINGs (2+ seconds).
 * WHEN: Auction includes network buyers that require PING requests.
 * HOW: Message, music loop, periodic reassurance, then redirect.
 *
 * DESIGN: For network auctions, we play music to keep caller engaged
 *         while waiting for network PING responses (up to 2 seconds each).
 *
 * @param auctionUrl - URL to redirect to when auction completes
 * @param options - Configuration options
 * @returns TwiML string with extended hold
 */
export function buildExtendedHold(
  auctionUrl: string,
  options: LongHoldOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  // Initial message
  const initialMessage = options.initialMessage ||
    'Please hold while we find the best specialist in your area.';
  response.say({ voice }, initialMessage);

  // Get music URL
  const musicUrl = options.musicUrl ||
    (options.musicStyle ? TWILIO_HOLD_MUSIC[options.musicStyle] : DEFAULT_HOLD_MUSIC);

  // Play short music clip (don't loop - we redirect after auction completes)
  // Use a short segment to keep response time low
  response.play({}, musicUrl);

  // Redirect to auction result
  response.redirect({ method: 'POST' }, auctionUrl);

  const twimlString = response.toString();
  logTwimlGenerated({
    callId: options.callId,
    twimlType: 'extendedHold',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for rejection message
 */
export interface RejectionOptions {
  reason?: string;
  voice?: string;
}

/**
 * Build rejection message and hangup
 * @param message The rejection message to speak
 * @param options Additional rejection configuration
 * @returns TwiML string
 */
export function buildRejection(
  message: string,
  options: RejectionOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  response.say({ voice }, message);
  response.hangup();

  const twimlString = response.toString();
  logTwimlGenerated({
    twimlType: 'rejection',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for cascade transfer
 */
export interface CascadeTransferOptions {
  timeout?: number;
  record?: boolean;
}

/**
 * Build cascade transfer (next buyer in line when first doesn't answer)
 * @param phoneNumber The phone number to transfer to
 * @param callerId The caller ID to display
 * @param position Current cascade position (1-indexed)
 * @param callId The call ID for callback tracking
 * @param options Additional cascade configuration
 * @returns TwiML string
 */
export function buildCascadeTransfer(
  phoneNumber: string,
  callerId: string,
  position: number,
  callId: string,
  options: CascadeTransferOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL;

  // Build dial attributes with cascade callback
  // Default timeout is 10 seconds (industry standard for fast rerouting)
  const dialAttributes: Record<string, unknown> = {
    callerId,
    action: `${baseUrl}/api/calls/cascade?callId=${callId}&position=${position}`,
    method: 'POST',
    timeout: options.timeout || 10,
  };

  // Add recording if requested
  if (options.record) {
    dialAttributes.record = 'record-from-ringing-dual';
    dialAttributes.recordingStatusCallback = `${baseUrl}/api/calls/recording`;
    dialAttributes.recordingStatusCallbackMethod = 'POST';
  }

  const dial = response.dial(dialAttributes);
  dial.number(phoneNumber);

  const twimlString = response.toString();
  logTwimlGenerated({
    callId,
    twimlType: 'cascadeTransfer',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Options for simple announcement
 */
export interface AnnouncementOptions {
  redirectUrl?: string;
  voice?: string;
}

/**
 * Build simple announcement (no gather)
 * @param message The message to speak
 * @param options Additional announcement configuration
 * @returns TwiML string
 */
export function buildAnnouncement(
  message: string,
  options: AnnouncementOptions = {}
): string {
  const response = new twiml.VoiceResponse();
  const voice = (options.voice || DEFAULT_VOICE) as typeof DEFAULT_VOICE;

  response.say({ voice }, message);

  if (options.redirectUrl) {
    response.redirect({ method: 'POST' }, options.redirectUrl);
  }

  const twimlString = response.toString();
  logTwimlGenerated({
    twimlType: 'announcement',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Build a simple pause response (useful for async processing)
 * @param seconds Number of seconds to pause (default 1)
 * @param redirectUrl URL to redirect to after pause
 * @returns TwiML string
 */
export function buildPause(seconds: number = 1, redirectUrl?: string): string {
  const response = new twiml.VoiceResponse();

  response.pause({ length: seconds });

  if (redirectUrl) {
    response.redirect({ method: 'POST' }, redirectUrl);
  }

  const twimlString = response.toString();
  logTwimlGenerated({
    twimlType: 'pause',
    twiml: twimlString,
  });

  return twimlString;
}

/**
 * Build empty response (acknowledge webhook without action)
 * @returns TwiML string
 */
export function buildEmptyResponse(): string {
  const response = new twiml.VoiceResponse();
  return response.toString();
}

/**
 * Export hold music options for use in admin configuration
 */
export const HOLD_MUSIC_OPTIONS = TWILIO_HOLD_MUSIC;
