import { useCallback, useRef, useState } from "react";

interface UseCameraResult {
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  cameraError: string | null;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
}

export function useCamera(): UseCameraResult {
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null);

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported on this device");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      return true;
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied");
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found on this device");
      } else {
        setCameraError("Failed to access camera");
      }
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  return {
    cameraVideoRef,
    isCameraActive,
    cameraError,
    startCamera,
    stopCamera,
  };
}
