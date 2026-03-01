import { useCallback, useRef, useState } from "react";
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from "@heygen/streaming-avatar";

async function fetchAccessToken(): Promise<string> {
  // The HeyGen token endpoint requires a server-side call.
  // We proxy through our backend for key security.
  const res = await fetch("/api/v1/flow/heygen-token");
  const data = await res.json();
  return data.token;
}

export function useHeyGenAvatar() {
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAvatar = useCallback(async () => {
    try {
      setError(null);

      let token: string;
      try {
        token = await fetchAccessToken();
      } catch {
        // If token endpoint not available, use placeholder
        setError("HeyGen API key not configured. Avatar will not be displayed.");
        return;
      }

      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
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

      await avatar.createStartAvatar({
        quality: AvatarQuality.Medium,
        avatarName: "default",
        language: "en",
      });
    } catch (err: any) {
      setError(err.message || "Failed to start avatar");
    }
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!avatarRef.current) return;
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
    startAvatar,
    speakText,
    stopAvatar,
    error,
  };
}
