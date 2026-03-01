import axios from "axios";
import type {
  FlowBusiness,
  Session,
  MessageResponse,
  CompleteResponse,
  ConsentResponse,
  RewardResponse,
} from "../types/flow";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

// Separate axios instance — no auth interceptor (public endpoints)
const flowClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const flowApi = {
  getBusiness: (slug: string) =>
    flowClient.get<FlowBusiness>(`/flow/${slug}`),

  startSession: (slug: string, visitorId: string, requestId: string, inputMode: string = "voice") =>
    flowClient.post<Session>(`/flow/${slug}/start`, {
      visitor_id: visitorId,
      request_id: requestId,
      input_mode: inputMode,
    }),

  sendMessage: (sessionId: string, content: string, source: string = "text") =>
    flowClient.post<MessageResponse>(`/flow/session/${sessionId}/message`, {
      content,
      source,
    }),

  completeSession: (sessionId: string) =>
    flowClient.post<CompleteResponse>(`/flow/session/${sessionId}/complete`),

  confirmReview: (sessionId: string, reviewText: string) =>
    flowClient.post(`/flow/session/${sessionId}/confirm-review`, {
      review_text: reviewText,
    }),

  submitConsent: (sessionId: string, consentWebsite: boolean, consentGoogle: boolean) =>
    flowClient.post<ConsentResponse>(`/flow/session/${sessionId}/consent`, {
      consent_website: consentWebsite,
      consent_google: consentGoogle,
    }),

  recordGoogleClicked: (sessionId: string) =>
    flowClient.post(`/flow/session/${sessionId}/google-clicked`),

  recordGoogleStatus: (sessionId: string, posted: boolean) =>
    flowClient.post(`/flow/session/${sessionId}/google-status`, { posted }),

  submitContact: (sessionId: string, data: { name?: string; phone?: string; email?: string }) =>
    flowClient.post(`/flow/session/${sessionId}/contact`, data),

  claimReward: (sessionId: string, sendSms: boolean = false, phone?: string) =>
    flowClient.post<RewardResponse>(`/flow/session/${sessionId}/reward`, {
      send_sms: sendSms,
      phone,
    }),
};
