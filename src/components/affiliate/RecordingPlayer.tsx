'use client';

/**
 * RecordingPlayer - Audio player for call recordings
 *
 * WHY: Affiliates need to listen to their call recordings for quality review.
 *      This component provides a custom audio player with skip controls,
 *      progress bar, and handles various recording states.
 *
 * WHEN: Displayed on call detail page when recording is available.
 *       Also used inline on the calls list for quick playback.
 *
 * HOW: HTML5 audio player with custom controls, skip buttons, and progress bar.
 *      Handles loading states, errors, and different recording statuses.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RecordingPlayerProps {
  recordingUrl: string | null;
  recordingStatus: string;
  duration: number;
  callId: string;
}

/**
 * WHY: Format seconds into MM:SS display format.
 * WHEN: Displaying current time and total duration.
 * HOW: Simple math division and modulo with zero-padding.
 */
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingPlayer({
  recordingUrl,
  recordingStatus,
  duration,
  callId
}: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state when recording URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setIsLoading(true);
    setError(null);
  }, [recordingUrl, callId]);

  /**
   * WHY: Toggle play/pause state.
   * WHEN: User clicks play/pause button.
   * HOW: Use HTML5 audio API play() and pause() methods.
   */
  const handlePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        setError('Unable to play recording: ' + err.message);
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  /**
   * WHY: Skip forward or backward in the recording.
   * WHEN: User clicks skip buttons.
   * HOW: Adjust currentTime property with bounds checking.
   */
  const handleSkip = useCallback((seconds: number) => {
    if (!audioRef.current) return;

    const newTime = Math.max(
      0,
      Math.min(audioRef.current.currentTime + seconds, audioDuration)
    );
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [audioDuration]);

  /**
   * WHY: Seek to specific position in recording.
   * WHEN: User drags progress slider.
   * HOW: Update audio currentTime from range input value.
   */
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  /**
   * WHY: Toggle audio mute state.
   * WHEN: User clicks volume button.
   * HOW: Toggle muted property on audio element.
   */
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  /**
   * WHY: Retry loading after an error.
   * WHEN: User clicks retry button after load failure.
   * HOW: Reset error state and reload audio element.
   */
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    audioRef.current?.load();
  }, []);

  // Handle recording not available states
  if (recordingStatus === 'PENDING' || recordingStatus === 'PROCESSING') {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
        <p className="text-gray-600">Recording is being processed...</p>
        <p className="text-sm text-gray-500 mt-1">This usually takes a few minutes.</p>
      </div>
    );
  }

  if (!recordingUrl || recordingStatus === 'ABSENT' || recordingStatus === 'DELETED') {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Recording not available</p>
        <p className="text-sm text-gray-500 mt-1">
          {recordingStatus === 'ABSENT'
            ? 'Call was too short to record.'
            : recordingStatus === 'DELETED'
              ? 'Recording has been removed.'
              : 'Recording is unavailable.'}
        </p>
      </div>
    );
  }

  if (recordingStatus === 'DOWNLOAD_FAILED' || recordingStatus === 'UPLOAD_FAILED') {
    return (
      <div className="bg-yellow-50 rounded-lg p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
        <p className="text-yellow-700">Recording processing failed</p>
        <p className="text-sm text-yellow-600 mt-1">
          Our team has been notified. Please check back later.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={handleRetry}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <audio
        ref={audioRef}
        src={recordingUrl}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onDurationChange={() => {
          const dur = audioRef.current?.duration;
          if (dur && !isNaN(dur) && isFinite(dur)) {
            setAudioDuration(dur);
          }
        }}
        onEnded={() => setIsPlaying(false)}
        onLoadedData={() => setIsLoading(false)}
        onCanPlay={() => setIsLoading(false)}
        onError={(e) => {
          const audio = e.target as HTMLAudioElement;
          if (audio.error) {
            switch (audio.error.code) {
              case MediaError.MEDIA_ERR_NETWORK:
                setError('Network error. Please check your connection.');
                break;
              case MediaError.MEDIA_ERR_DECODE:
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                setError('Unable to play this recording format.');
                break;
              default:
                setError('Unable to load recording.');
            }
          }
          setIsLoading(false);
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">Loading recording...</span>
        </div>
      )}

      {/* Player controls */}
      {!isLoading && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-12 text-right font-mono">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={audioDuration || duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-sm text-gray-500 w-12 font-mono">
              {formatTime(audioDuration || duration)}
            </span>
          </div>

          {/* Control buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSkip(-15)}
              className="text-gray-600"
              title="Skip back 15 seconds"
            >
              <SkipBack className="h-5 w-5" />
              <span className="text-xs ml-1">15s</span>
            </Button>

            <Button
              variant="default"
              size="lg"
              onClick={handlePlay}
              className="bg-emerald-500 hover:bg-emerald-600 rounded-full w-12 h-12 p-0"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSkip(15)}
              className="text-gray-600"
              title="Skip forward 15 seconds"
            >
              <span className="text-xs mr-1">15s</span>
              <SkipForward className="h-5 w-5" />
            </Button>

            <div className="ml-4 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="text-gray-600"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
