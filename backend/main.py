"""ResumeCraft AI backend.

A thin FastAPI proxy that holds the Google Gemini API key server-side and
exposes a single generation endpoint the Angular UI calls. The key lives only
in this server's environment (GEMINI_API_KEY) — it is never sent to the browser.

The Angular app builds the full prompt (parse / tailor / common-changes) and
POSTs it here; we forward it to Gemini and return the model's raw text, which
the UI then parses as JSON. Keeping prompt-building and validation in the UI
means this service stays generic and provider-agnostic.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()

# Comma-separated list of browser origins allowed to call this API — your
# deployed Angular site plus local dev. Defaults to the Angular dev server.
_raw_origins = os.environ.get("FRONTEND_ORIGIN", "http://localhost:4200")
ALLOWED_ORIGINS = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]

app = FastAPI(title="ResumeCraft AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["content-type"],
)

# Created lazily so the app can boot (and /health can answer) even before the
# key is set — generation then fails with a clear message instead of a crash.
_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the server.",
        )
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    # Mirrors the maxTokens the UI already computes per call.
    maxTokens: int = Field(default=8000, ge=1, le=32000)


class GenerateResponse(BaseModel):
    text: str


@app.get("/health")
def health() -> dict:
    """Liveness probe + quick config check (does NOT expose the key)."""
    return {
        "status": "ok",
        "model": GEMINI_MODEL,
        "keyConfigured": bool(GEMINI_API_KEY),
    }


@app.post("/api/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    client = get_client()
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=req.prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=req.maxTokens,
                temperature=0.4,
                # The UI's prompts already ask for JSON; requesting a JSON mime
                # type makes Gemini emit valid JSON reliably.
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:  # surface provider errors to the client
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}") from exc

    text = (response.text or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response.")
    return GenerateResponse(text=text)
