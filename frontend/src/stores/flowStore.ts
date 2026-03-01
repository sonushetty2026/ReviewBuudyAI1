import { create } from "zustand";
import type {
  FlowBusiness,
  Session,
  CompleteResponse,
  RewardResponse,
  ConversationStep,
  PresentationMode,
} from "../types/flow";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  source: "voice" | "text";
}

interface FlowState {
  business: FlowBusiness | null;
  session: Session | null;
  currentStep: ConversationStep;
  messages: ChatMessage[];
  conversationState: string;
  analysisResult: CompleteResponse | null;
  reviewText: string;
  googleReviewUrl: string | null;
  reward: RewardResponse | null;
  inputMode: "voice" | "text";
  presentationMode: PresentationMode;

  setBusiness: (business: FlowBusiness) => void;
  setSession: (session: Session) => void;
  setCurrentStep: (step: ConversationStep) => void;
  addMessage: (msg: ChatMessage) => void;
  setConversationState: (state: string) => void;
  setAnalysisResult: (result: CompleteResponse) => void;
  setReviewText: (text: string) => void;
  setGoogleReviewUrl: (url: string | null) => void;
  setReward: (reward: RewardResponse) => void;
  setInputMode: (mode: "voice" | "text") => void;
  setPresentationMode: (mode: PresentationMode) => void;
  reset: () => void;
}

const initialState = {
  business: null,
  session: null,
  currentStep: "conversation" as ConversationStep,
  messages: [] as ChatMessage[],
  conversationState: "greeting",
  analysisResult: null,
  reviewText: "",
  googleReviewUrl: null,
  reward: null,
  inputMode: "voice" as "voice" | "text",
  presentationMode: "fast" as PresentationMode,
};

export const useFlowStore = create<FlowState>((set) => ({
  ...initialState,

  setBusiness: (business) => set({ business }),
  setSession: (session) => set({ session }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setConversationState: (conversationState) => set({ conversationState }),
  setAnalysisResult: (analysisResult) => set({ analysisResult }),
  setReviewText: (reviewText) => set({ reviewText }),
  setGoogleReviewUrl: (googleReviewUrl) => set({ googleReviewUrl }),
  setReward: (reward) => set({ reward }),
  setInputMode: (inputMode) => set({ inputMode }),
  setPresentationMode: (presentationMode) => set({ presentationMode }),
  reset: () => set(initialState),
}));
