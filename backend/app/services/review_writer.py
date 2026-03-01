import logging
import re

import anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)


async def rewrite_review(
    conversation_text: str,
    business_name: str,
    star_rating: int,
    key_topics: list[str],
) -> str:
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    topics_str = ", ".join(key_topics) if key_topics else "their overall experience"

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": f"""Write a Google review for {business_name} based on this customer feedback conversation.

Requirements:
- First-person perspective (as if the customer wrote it)
- 50-150 words
- Mention specific details from the conversation: {topics_str}
- Match the sentiment: {star_rating} stars out of 5
- Sound natural and human (not robotic or AI-generated)
- Do NOT include a star rating in the text
- Do NOT use excessive exclamation marks or superlatives

Conversation:
{conversation_text}

Write ONLY the review text, nothing else.""",
                }
            ],
        )
    except Exception as e:
        logger.error(f"Anthropic API error during review rewrite: {e}", exc_info=True)
        raise

    review = response.content[0].text.strip()
    review = re.sub(r'^["\']|["\']$', '', review)
    return review
