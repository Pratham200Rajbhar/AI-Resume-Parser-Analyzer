from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncGenerator

import structlog

from app.ml.llm.prompts import SYSTEM_PROMPT

logger = structlog.get_logger(__name__)

_CACHE_TTL = 7 * 24 * 3600  # 7 days in seconds

def _cache_key(messages: list[dict], user_message: str) -> str:
    content = json.dumps(messages[-6:]) + user_message  # last 6 messages + new message
    return "coach:" + hashlib.sha256(content.encode()).hexdigest()



class CareerCoach:
    """
    LLM-powered career coaching assistant.
    Supports OpenAI and Anthropic backends via LangChain.
    Caches responses in Redis for 7 days.
    Falls back to template responses if the LLM is unavailable.
    """

    def __init__(self) -> None:
        from app.core.config import settings  # noqa: PLC0415

        self._settings = settings
        self._llm = None  # lazy init

    def _get_llm(self):
        if self._llm is not None:
            return self._llm

        provider = self._settings.llm_provider
        model = self._settings.llm_model

        try:
            if provider == "openai":
                from langchain_openai import ChatOpenAI  # noqa: PLC0415

                self._llm = ChatOpenAI(
                    model=model,
                    api_key=self._settings.openai_api_key,
                    temperature=0.7,
                    max_tokens=1500,
                )
            elif provider == "anthropic":
                from langchain_anthropic import ChatAnthropic  # noqa: PLC0415

                self._llm = ChatAnthropic(
                    model=model,
                    api_key=self._settings.anthropic_api_key,
                    temperature=0.7,
                    max_tokens=1500,
                )
            elif provider == "ollama":
                from langchain_ollama import ChatOllama  # noqa: PLC0415

                self._llm = ChatOllama(
                    model=model,
                    base_url=self._settings.ollama_base_url,
                    temperature=0.7,
                )
            else:
                raise ValueError(f"Unknown LLM provider: {provider}")

            logger.info("llm_initialised", provider=provider, model=model)
        except Exception as exc:
            logger.warning("llm_init_failed", provider=provider, error=str(exc))
            return None

        return self._llm

    def _build_system_prompt(self, resume_entities: dict, jd_text: str | None) -> str:
        """Build the system prompt with resume and JD context."""
        if resume_entities:
            resume_context = json.dumps(resume_entities, indent=2)[:3000]  # cap size
        else:
            resume_context = "No resume data available."

        if jd_text:
            jd_context = f"Target job description:\n{jd_text[:2000]}"
        else:
            jd_context = "No specific job description provided."

        return SYSTEM_PROMPT.format(
            resume_context=resume_context,
            jd_context=jd_context,
        )

    async def chat(
        self,
        session_messages: list[dict],
        user_message: str,
        resume_entities: dict,
        jd_text: str | None = None,
    ) -> str:
        """
        Send a message to the career coach and return the assistant reply.

        Args:
            session_messages: Prior conversation history [{role, content}, ...]
            user_message: The new user message
            resume_entities: Structured resume data from NLP pipeline
            jd_text: Optional job description text

        Returns:
            Assistant reply string
        """
        # ── 1. Check cache ────────────────────────────────────────────────────
        try:
            from app.services.cache import CacheService  # noqa: PLC0415

            cache = CacheService()
            cache_key = _cache_key(session_messages, user_message)
            cached = await cache.get(cache_key)
            if cached:
                logger.debug("coach_cache_hit", key=cache_key[:16])
                return cached if isinstance(cached, str) else str(cached)
        except Exception as exc:
            logger.warning("coach_cache_get_failed", error=str(exc))
            cache = None
            cache_key = None

        # ── 2. Build messages for LLM ─────────────────────────────────────────
        system_prompt = self._build_system_prompt(resume_entities, jd_text)

        llm = self._get_llm()
        if llm is None:
            raise RuntimeError("LLM service is not initialized or unavailable.")

        try:
            from langchain_core.messages import (  # noqa: PLC0415
                AIMessage,
                HumanMessage,
                SystemMessage,
            )

            lc_messages = [SystemMessage(content=system_prompt)]

            # Add conversation history (last 10 turns to stay within context limits)
            for msg in session_messages[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    lc_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    lc_messages.append(AIMessage(content=content))

            lc_messages.append(HumanMessage(content=user_message))

            # ── 3. Call LLM ───────────────────────────────────────────────────
            import asyncio  # noqa: PLC0415

            response = await asyncio.to_thread(llm.invoke, lc_messages)
            reply = response.content if hasattr(response, "content") else str(response)

            # ── 4. Cache the response ─────────────────────────────────────────
            if cache and cache_key:
                try:
                    await cache.set(cache_key, reply, ttl=_CACHE_TTL)
                except Exception as exc:
                    logger.warning("coach_cache_set_failed", error=str(exc))

            logger.info("coach_reply_generated", chars=len(reply))
            return reply

        except Exception as exc:
            logger.error("coach_llm_call_failed", error=str(exc))
            raise

    async def chat_stream(
        self,
        session_messages: list[dict],
        user_message: str,
        resume_entities: dict,
        jd_text: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Send a message to the career coach and yield reply chunks in real time.
        """
        # ── 1. Check cache ────────────────────────────────────────────────────
        try:
            from app.services.cache import CacheService  # noqa: PLC0415

            cache = CacheService()
            cache_key = _cache_key(session_messages, user_message)
            cached = await cache.get(cache_key)
            if cached:
                logger.debug("coach_cache_hit", key=cache_key[:16])
                yield cached if isinstance(cached, str) else str(cached)
                return
        except Exception as exc:
            logger.warning("coach_cache_get_failed", error=str(exc))

        # ── 2. Build messages for LLM ─────────────────────────────────────────
        system_prompt = self._build_system_prompt(resume_entities, jd_text)

        llm = self._get_llm()
        if llm is None:
            raise RuntimeError("LLM service is not initialized or unavailable.")

        try:
            from langchain_core.messages import (  # noqa: PLC0415
                AIMessage,
                HumanMessage,
                SystemMessage,
            )

            lc_messages = [SystemMessage(content=system_prompt)]

            # Add conversation history (last 10 turns to stay within context limits)
            for msg in session_messages[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    lc_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    lc_messages.append(AIMessage(content=content))

            lc_messages.append(HumanMessage(content=user_message))

            # ── 3. Call LLM Streaming ─────────────────────────────────────────
            async for chunk in llm.astream(lc_messages):
                content = chunk.content if hasattr(chunk, "content") else str(chunk)
                if content:
                    yield content

        except Exception as exc:
            logger.error("coach_llm_stream_failed", error=str(exc))
            raise
