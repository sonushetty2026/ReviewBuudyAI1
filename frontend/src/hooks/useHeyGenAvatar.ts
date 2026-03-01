import { useCallback, useRef, useState } from "react";
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from "@heygen/streaming-avatar";

// TODO: Migrate to @heygen/liveavatar-web-sdk once HeyGen completes the
// Interactive Avatar → LiveAvatar transition. The new SDK uses a LiveKit-based
// architecture with server-side session management. See:
// https://docs.liveavatar.com/docs/quick-start-guide

// Default avatar ID — "default" is NOT a valid HeyGen avatar ID and causes
// STREAM_READY to never fire.  Use a real avatar from the HeyGen dashboard.
// Override via the VITE_HEYGEN_AVATAR_ID env var.
const DEFAULT_AVATAR_ID = import.meta.env.VITE_HEYGEN_AVATAR_ID || "Wayne_20240711";

// How long to wait for STREAM_READY before giving up (ms)
const AVATAR_TIMEOUT_MS = 15_000;

async function fetchAccessToken(): Promise<string> {
  const res = await fetch("/api/v1/flow/heygen-token");
  const data = await res.json();
  return data.token;
}

export function useHeyGenAvatar() {
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarTimedOutRef = useRef(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [avatarTimedOut, setAvatarTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAvatar = useCallback(async (avatarId?: string) => {
    try {
      setError(null);
      setAvatarTimedOut(false);
      avatarTimedOutRef.current = false;

      let token: string;
      try {
        token = await fetchAccessToken();
      } catch {
        setError("HeyGen API key not configured. Avatar will not be displayed.");
        return;
      }

      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (videoRef.current && event.detail) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch(() => {});
        }
        setIsAvatarReady(true);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setIsAvatarSpeaking(true);
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setIsAvatarSpeaking(false);
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setIsAvatarReady(false);
      });

      // Timeout: if STREAM_READY never fires, let the UI proceed without the avatar
      timeoutRef.current = setTimeout(() => {
        if (!avatarRef.current) return;
        avatarTimedOutRef.current = true;
        setAvatarTimedOut(true);
        setError("Avatar took too long to load. Voice mode is still active.");
      }, AVATAR_TIMEOUT_MS);

      await avatar.createStartAvatar({
        quality: AvatarQuality.Medium,
        avatarName: avatarId || DEFAULT_AVATAR_ID,
        language: "en",
      });
    } catch (err: any) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError(err.message || "Failed to start avatar");
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!avatarRef.current || avatarTimedOutRef.current) return;
    try {
      await avatarRef.current.speak({
        text,
        taskType: TaskType.REPEAT,
      });
    } catch (err: any) {
      console.error("Avatar speak error:", err);
    }
  }, []);

  const stopAvatar = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (avatarRef.current) {
      try {
        await avatarRef.current.stopAvatar();
      } catch {
        // ignore cleanup errors
      }
      avatarRef.current = null;
    }
    setIsAvatarReady(false);
    setIsAvatarSpeaking(false);
  }, []);

  return {
    videoRef,
    isAvatarReady,
    isAvatarSpeaking,
    avatarTimedOut,
    startAvatar,
    speakText,
    stopAvatar,
    error,
  };
}
