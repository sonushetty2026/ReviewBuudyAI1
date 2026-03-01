import { useCallback, useRef, useState } from "react";

interface UseAudioRecorderOptions {
  sessionId: string;
  onTranscript: (text: string, isFinal: boolean) => void;
}

export function useAudioRecorder({ sessionId, onTranscript }: UseAudioRecorderOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);

      // Guard: getUserMedia requires HTTPS on mobile browsers
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionDenied(true);
        setError("Microphone not supported. Please use HTTPS or type instead.");
        return;
      }

      // Get microphone access
      // Note: sampleRate constraint intentionally omitted — iOS Safari throws
      // OverconstrainedError if sampleRate is specified. The AudioContext below
      // handles resampling to 16000 Hz regardless of device sample rate.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (err: any) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionDenied(true);
          setError("Microphone permission denied");
          return;
        }
        throw err;
      }

      mediaStreamRef.current = stream;

      // Open WebSocket to backend Deepgram proxy
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/v1/flow/session/${sessionId}/audio-stream`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript" && data.text) {
            onTranscript(data.text, data.is_final);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setError("Audio connection error");
      };

      ws.onclose = () => {
        setIsRecording(false);
      };

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("WebSocket connection failed"));
      });

      // Set up audio processing at 16000 Hz — AudioContext resamples from device rate
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Resume AudioContext if suspended (required after user gesture on iOS)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);

      // ScriptProcessorNode: captures raw PCM16 chunks to send over WebSocket
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]!));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err: any) {
      setError(err.message || "Failed to start recording");
    }
  }, [sessionId, onTranscript]);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    permissionDenied,
  };
}
