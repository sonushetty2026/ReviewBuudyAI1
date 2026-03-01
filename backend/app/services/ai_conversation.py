import json
import logging
import re
from enum import Enum

import anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)


class ConversationState(str, Enum):
    GREETING = "greeting"
    LISTENING = "listening"
    PROBING = "probing"
    WRAPPING_UP = "wrapping_up"
    COMPLETE = "complete"


PROFANITY_LIST = {
    "fuck", "shit", "ass", "bitch", "damn", "bastard", "crap", "dick",
    "piss", "cock", "cunt", "motherfucker", "asshole", "douchebag",
}


def build_system_prompt(
    business_name: str,
    avatar_style: str = "friendly",
    welcome_message: str = "",
) -> str:
    style_instructions = {
        "friendly": "Be chill, warm, and slightly funny. Use casual language.",
        "professional": "Be professional and warm. Use polite, respectful language.",
        "energetic": "Be high-energy and enthusiastic. Show excitement about their feedback.",
    }
    style = style_instructions.get(avatar_style, style_instructions["friendly"])

    return f"""You are a feedback concierge for {business_name}. Your role is to have a brief, natural conversation to collect customer feedback about their experience.

PERSONALITY: {style}

CONVERSATION RULES:
- Keep every reply to 1-2 sentences maximum (under 100 tokens)
- Follow the conversation state machine:
  1. GREETING: Welcome the customer warmly. Ask how their experience was today.
  2. LISTENING: Listen to their initial feedback. Acknowledge what they said.
  3. PROBING: Ask 1-2 follow-up questions about specifics (food, service, atmosphere, etc.)
  4. WRAPPING_UP: Thank them and let them know you'll help them share their feedback.
  5. COMPLETE: Conversation is done.
- Wrap up after the customer has given 3-4 substantive replies.
- Never ask more than one question at a time.

FORBIDDEN TOPICS - If the customer brings up any of these, deflect immediately:
- Politics, religion, sexual content, personal insults
- Requests for refunds, discounts, or compensation
- Off-topic conversations unrelated to their business experience
- Deflection response: "I appreciate the creativity! Let's get back to your experience at {business_name} today."

IMPORTANT: After every response, append a metadata tag on a new line:
<metadata>{{"state": "current_state", "ready_to_complete": true_or_false}}</metadata>

The state should reflect where you are in the conversation. Set ready_to_complete to true when you've gathered enough feedback (usually after 3-4 customer messages).

{f'Custom welcome context: {welcome_message}' if welcome_message else ''}"""


def check_profanity(text: str) -> bool:
    words = set(re.findall(r'\b\w+\b', text.lower()))
    return bool(words & PROFANITY_LIST)


async def get_conversation_response(
    messages: list[dict],
    business_name: str,
    avatar_style: str = "friendly",
    welcome_message: str = "",
    message_count: int = 0,
) -> dict:
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    system_prompt = build_system_prompt(business_name, avatar_style, welcome_message)

    if message_count >= settings.max_conversation_messages:
        system_prompt += (
            "\n\nIMPORTANT: The conversation has reached the maximum length. "
            "You MUST wrap up now. Thank the customer and set ready_to_complete to true."
        )

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=150,
            system=system_prompt,
            messages=messages,
        )
    except anthropic.RateLimitError:
        logger.error("Anthropic rate limit hit during conversation")
        return {
            "text": "I'm having a moment — could you say that again?",
            "state": "listening",
            "ready_to_complete": False,
        }
    except Exception as e:
        logger.error(f"Anthropic API error during conversation: {e}", exc_info=True)
        return {
            "text": "Sorry, I had a brief hiccup. Could you repeat that?",
            "state": "listening",
            "ready_to_complete": False,
        }

    raw_text = response.content[0].text

    metadata = {"state": "listening", "ready_to_complete": False}
    metadata_match = re.search(r'<metadata>(.*?)</metadata>', raw_text, re.DOTALL)
    if metadata_match:
        try:
            metadata = json.loads(metadata_match.group(1))
        except (json.JSONDecodeError, ValueError):
            pass

    display_text = re.sub(r'\s*<metadata>.*?</metadata>\s*', '', raw_text, flags=re.DOTALL).strip()

    return {
        "text": display_text,
        "state": metadata.get("state", "listening"),
        "ready_to_complete": metadata.get("ready_to_complete", False),
    }


async def analyze_sentiment_and_extract(
    conversation_text: str,
    business_name: str,
) -> dict:
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this customer feedback conversation at {business_name} and return a JSON object with these fields:

- sentiment_label: "positive", "negative", or "neutral"
- sentiment_score: float from -1.0 (very negative) to 1.0 (very positive)
- star_rating: integer 1-5 (what star rating would this customer likely give?)
- key_topics: list of 2-5 specific topics mentioned (e.g., "coffee quality", "wait time", "friendly staff")
- summary: 1-2 sentence summary of the customer's experience

Conversation:
{conversation_text}

Return ONLY valid JSON, no other text.""",
                }
            ],
        )
    except Exception as e:
        logger.error(f"Anthropic API error during sentiment analysis: {e}", exc_info=True)
        return {
            "sentiment_label": "neutral",
            "sentiment_score": 0.0,
            "star_rating": 3,
            "key_topics": [],
            "summary": "Customer submitted feedback (analysis unavailable).",
        }

    raw = response.content[0].text.strip()

    try:
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse sentiment JSON: {e}. Raw response: {raw[:200]}")

    return {
        "sentiment_label": "neutral",
        "sentiment_score": 0.0,
        "star_rating": 3,
        "key_topics": [],
        "summary": "Unable to analyze conversation.",
    }
