export interface FlowBranding {
  primary_color: string;
  secondary_color: string;
  avatar_style: string;
  welcome_message: string;
  thank_you_message: string;
  logo_url: string | null;
}

export interface FlowBusiness {
  id: string;
  name: string;
  slug: string;
  branding: FlowBranding;
}

export interface Session {
  id: string;
  status: string;
  greeting: string;
}

export interface MessageResponse {
  text: string;
  state: string;
  ready_to_complete: boolean;
  sequence: number;
}

export interface CompleteResponse {
  sentiment_label: string;
  star_rating: number;
  summary: string;
  rewritten_review: string | null;
  flow: "positive" | "negative";
}

export interface ConsentResponse {
  google_review_url: string | null;
}

export interface RewardResponse {
  code: string;
  description: string;
  expires_at: string | null;
  sms_sent: boolean;
}

export interface Complaint {
  id: string;
  session_id: string;
  business_id?: string;
  status: string;
  priority: string;
  summary: string;
  resolution_notes?: string | null;
  assigned_to?: string | null;
  resolved_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  created_at: string;
  updated_at?: string;
}

export type ConversationStep =
  | "conversation"
  | "review_confirm"
  | "consent"
  | "google_review"
  | "return_check"
  | "empathy"
  | "contact_collection"
  | "reward"
  | "thank_you";
