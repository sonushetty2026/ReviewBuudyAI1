import { useCallback, useRef, useState } from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

// Default avatar ID — override via VITE_HEYGEN_AVATAR_ID env var.
const DEFAULT_AVATAR_ID = import.meta.env.VITE_HEYGEN_AVATAR_ID || "Wayne_20240711";

// How long to wait for SESSION_STREAM_READY before giving up (ms)
const AVATAR_TIMEOUT_MS = 15_000;

interface TokenResponse {
  token: string;
  session_id?: string;
  provider?: string;
}

async function fetchSessionToken(): Promise<TokenResponse> {
  const res = await fetch("/api/v1/flow/heygen-token");
  if (!res.ok) throw new Error("Failed to fetch avatar token");
  return res.json();
}

export function useHeyGenAvatar() {
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarTimedOutRef = useRef(false);
  const generationRef = useRef(0); // React StrictMode guard
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [avatarTimedOut, setAvatarTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAvatar = useCallback(async (avatarId?: string) => {
    const generation = ++generationRef.current;

    try {
      setError(null);
      setAvatarTimedOut(false);
      avatarTimedOutRef.current = false;

      let tokenData: TokenResponse;
      try {
        tokenData = await fetchSessionToken();
      } catch {
        setError("Avatar API key not configured. Avatar will not be displayed.");
        return;
      }

      // StrictMode double-mount guard
      if (generation !== generationRef.current) return;

      const session = new LiveAvatarSession(tokenData.token, {
        voiceChat: false,
      });
      sessionRef.current = session;

      // Listen for stream ready
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (generation !== generationRef.current) return;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Attach the avatar video/audio tracks to our video element
        if (videoRef.current) {
          session.attach(videoRef.current);
        }

        setIsAvatarReady(true);
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        if (generation !== generationRef.current) return;
        setIsAvatarReady(false);
      });

      // Agent-level events for speaking state
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        if (generation !== generationRef.current) return;
        setIsAvatarSpeaking(true);
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        if (generation !== generationRef.current) return;
        setIsAvatarSpeaking(false);
      });

      // Timeout: if stream never becomes ready, let UI proceed
      timeoutRef.current = setTimeout(() => {
        if (generation !== generationRef.current) return;
        avatarTimedOutRef.current = true;
        setAvatarTimedOut(true);
        setError("Avatar took too long to load. Voice mode is still active.");
      }, AVATAR_TIMEOUT_MS);

      await session.start();
    } catch (err: any) {
      if (generation !== generationRef.current) return;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setError(err.message || "Failed to start avatar");
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!sessionRef.current || avatarTimedOutRef.current) return;
    try {
      sessionRef.current.repeat(text);
    } catch (err: any) {
      console.error("Avatar speak error:", err);
    }
  }, []);

  const stopAvatar = useCallback(async () => {
    generationRef.current++; // invalidate any in-flight init
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (sessionRef.current) {
      try {
        await sessionRef.current.stop();
      } catch {
        // ignore cleanup errors
      }
      sessionRef.current = null;
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
