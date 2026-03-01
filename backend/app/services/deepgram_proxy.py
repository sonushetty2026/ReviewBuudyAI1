import asyncio
import json
import logging
import uuid

import websockets
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.feedback import FeedbackSession

logger = logging.getLogger(__name__)

DEEPGRAM_WS_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3"
    "&punctuate=true"
    "&interim_results=true"
    "&encoding=linear16"
    "&sample_rate=16000"
)


class DeepgramProxy:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.dg_ws = None

    async def connect(self):
        headers = {"Authorization": f"Token {self.api_key}"}
        self.dg_ws = await websockets.connect(DEEPGRAM_WS_URL, extra_headers=headers)

    async def forward_audio(self, data: bytes):
        if self.dg_ws:
            await self.dg_ws.send(data)

    async def receive_transcripts(self, client_ws: WebSocket):
        if not self.dg_ws:
            return
        try:
            async for message in self.dg_ws:
                data = json.loads(message)
                if data.get("type") == "Results":
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [{}])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "")
                        is_final = data.get("is_final", False)
                        if transcript:
                            await client_ws.send_json({
                                "type": "transcript",
                                "text": transcript,
                                "is_final": is_final,
                            })
        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Deepgram receive error: {e}")

    async def close(self):
        if self.dg_ws:
            try:
                await self.dg_ws.close()
            except Exception:
                pass


async def handle_audio_stream(
    client_ws: WebSocket,
    session_id: uuid.UUID,
    db: AsyncSession,
):
    result = await db.execute(
        select(FeedbackSession).where(FeedbackSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session or session.status == "completed":
        await client_ws.close(code=4004, reason="Invalid session")
        return

    settings = get_settings()
    proxy = DeepgramProxy(settings.deepgram_api_key)

    try:
        await proxy.connect()

        receive_task = asyncio.create_task(proxy.receive_transcripts(client_ws))

        try:
            while True:
                data = await client_ws.receive_bytes()
                await proxy.forward_audio(data)
        except WebSocketDisconnect:
            pass

        receive_task.cancel()
        try:
            await receive_task
        except asyncio.CancelledError:
            pass
    except Exception as e:
        logger.error(f"Audio stream error: {e}")
        try:
            await client_ws.close(code=4500, reason="Internal error")
        except Exception:
            pass
    finally:
        await proxy.close()
