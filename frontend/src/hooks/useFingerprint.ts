import { useCallback, useRef } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs-pro";

const FINGERPRINT_API_KEY = import.meta.env.VITE_FINGERPRINT_PRO_API_KEY || "";

export function useFingerprint() {
  const fpRef = useRef<any>(null);

  const getFingerprint = useCallback(async (): Promise<{
    visitorId: string;
    requestId: string;
  }> => {
    if (!FINGERPRINT_API_KEY) {
      // Fallback for development without Fingerprint Pro
      return {
        visitorId: `dev-${Math.random().toString(36).substring(2, 10)}`,
        requestId: "",
      };
    }

    if (!fpRef.current) {
      fpRef.current = await FingerprintJS.load({
        apiKey: FINGERPRINT_API_KEY,
      });
    }

    const result = await fpRef.current.get();
    return {
      visitorId: result.visitorId,
      requestId: result.requestId,
    };
  }, []);

  return { getFingerprint };
}
