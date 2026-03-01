import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { flowApi } from "../../api/flow";
import { useFlowStore } from "../../stores/flowStore";
import { useFingerprint } from "../../hooks/useFingerprint";
import type { PresentationMode } from "../../types/flow";

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { business, setBusiness, setSession, setInputMode, setPresentationMode, reset } =
    useFlowStore();
  const { getFingerprint } = useFingerprint();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startingMode, setStartingMode] = useState<PresentationMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset();
    if (!slug) return;
    flowApi
      .getBusiness(slug)
      .then(({ data }) => {
        setBusiness(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Business not found");
        setLoading(false);
      });
  }, [slug]);

  const startSession = async (presentationMode: PresentationMode) => {
    if (!slug || starting) return;
    setStarting(true);
    setStartingMode(presentationMode);
    setError(null);

    try {
      const fp = await getFingerprint();
      const inputMode = "voice";
      setInputMode(inputMode);
      setPresentationMode(presentationMode);
      const { data } = await flowApi.startSession(
        slug,
        fp.visitorId,
        fp.requestId,
        inputMode,
        presentationMode
      );
      setSession(data);
      navigate(`/c/${slug}/session/${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("You've reached the session limit. Please try again later.");
      } else if (err.response?.status === 500) {
        setError("Server error. Please check the backend is running correctly.");
      } else if (!err.response) {
        setError("Cannot reach the server. Please check the backend is running.");
      } else {
        setError("Failed to start session. Please try again.");
      }
      setStarting(false);
      setStartingMode(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Oops!</h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!business) return null;

  const { branding } = business;

  const spinner = (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: branding.secondary_color + "10" }}
    >
      <div className="w-full max-w-md text-center">
        {branding.logo_url && (
          <img
            src={branding.logo_url}
            alt={business.name}
            className="w-20 h-20 mx-auto mb-4 rounded-full object-cover"
          />
        )}

        <h1
          className="text-3xl font-bold"
          style={{ color: branding.primary_color }}
        >
          {business.name}
        </h1>

        <p className="mt-4 text-lg text-gray-700">{branding.welcome_message}</p>

        <div className="mt-8 space-y-3">
          {/* Primary CTA: Fast mode (FaceTime-style) */}
          <button
            onClick={() => startSession("fast")}
            disabled={starting}
            className="w-full py-4 px-6 rounded-xl text-white font-semibold text-lg shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
            style={{ backgroundColor: branding.primary_color }}
          >
            {starting && startingMode === "fast" ? (
              <span className="flex items-center justify-center gap-2">
                {spinner}
                Starting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Start (Fast)
              </span>
            )}
          </button>

          {/* Secondary CTA: Camera background mode (AR-feel) */}
          <button
            onClick={() => startSession("camera")}
            disabled={starting}
            className="w-full py-3 px-6 rounded-xl font-medium border-2 transition-all hover:shadow-md disabled:opacity-50"
            style={{
              borderColor: branding.primary_color,
              color: branding.primary_color,
            }}
          >
            {starting && startingMode === "camera" ? (
              <span className="flex items-center justify-center gap-2">
                {spinner}
                Starting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Start with Camera (AR-feel)
              </span>
            )}
          </button>

          <p className="text-xs text-gray-400 mt-1">
            Camera mode uses your rear camera as a background for a wow effect
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Powered by Scan & Speak
        </p>
      </div>
    </div>
  );
}
