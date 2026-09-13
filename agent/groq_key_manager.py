import json
import logging
import os
import sys
import time
import httpx
import openai

# Ensure UTF-8 output on Windows console to prevent charmap encoding errors
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logger = logging.getLogger("groq-rotator")


class GroqKeyManager:
    def __init__(self):
        self.keys: list[str] = self._discover_keys()
        self.current_index = 0
        # key -> unix timestamp until which this key is on cooldown
        self.cooldowns: dict[str, float] = {}

    def _discover_keys(self) -> list[str]:
        found_keys: list[str] = []

        # 1. Primary key
        primary = os.getenv("GROQ_API_KEY", "").strip()
        if primary and len(primary) > 10:
            found_keys.append(primary)

        # 2. Numbered keys (GROQ_API_KEY_1, GROQ_API_KEY_2, etc.)
        for i in range(1, 25):
            k = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
            if k and len(k) > 10 and k not in found_keys:
                found_keys.append(k)

        # 3. Any other env vars starting with GROQ_API_KEY
        for env_k, env_v in sorted(os.environ.items()):
            if env_k.startswith("GROQ_API_KEY") and env_v.strip():
                val = env_v.strip()
                if len(val) > 10 and val not in found_keys:
                    found_keys.append(val)

        return found_keys

    def get_current_key(self) -> str:
        if not self.keys:
            return ""

        now = time.time()
        # Find a key that is not on cooldown
        for offset in range(len(self.keys)):
            candidate_idx = (self.current_index + offset) % len(self.keys)
            candidate_key = self.keys[candidate_idx]
            if self.cooldowns.get(candidate_key, 0) <= now:
                self.current_index = candidate_idx
                return candidate_key

        # If all are in cooldown, return the current one anyway
        return self.keys[self.current_index % len(self.keys)]

    def mark_rate_limited(self, key: str, cooldown_seconds: float = 60.0):
        self.cooldowns[key] = time.time() + cooldown_seconds

    def rotate_key(self, reason: str = "Rate limit reached (HTTP 429)") -> str:
        if len(self.keys) <= 1:
            return self.get_current_key()

        prev_idx = self.current_index % len(self.keys)
        failed_key = self.keys[prev_idx]
        self.mark_rate_limited(failed_key, cooldown_seconds=60.0)

        # Advance to next available key
        self.current_index = (self.current_index + 1) % len(self.keys)
        new_key = self.get_current_key()

        old_masked = f"...{failed_key[-6:]}"
        new_masked = f"...{new_key[-6:]}"

        msg = (
            f"\n⚠️  [GROQ LIMIT DETECTED]: Key #{prev_idx + 1} ({old_masked}) - {reason}\n"
            f"🔄  [AUTOMATIC FAILOVER]: Switched to Key #{self.current_index + 1} ({new_masked})! Retrying request..."
        )
        try:
            print(msg, flush=True)
        except Exception:
            pass
        logger.warning(msg)
        return new_key

    def print_status(self):
        banner = [
            "=" * 65,
            f"  🔑 GROQ MULTI-KEY ROTATOR: {len(self.keys)} API Keys Available",
        ]
        now = time.time()
        for i, k in enumerate(self.keys):
            is_active = (i == self.current_index)
            is_cooldown = (self.cooldowns.get(k, 0) > now)
            status_tag = " [ACTIVE]" if is_active else (" [COOLDOWN]" if is_cooldown else "")
            banner.append(f"     * Key #{i + 1}: ...{k[-6:]}{status_tag}")
        banner.append("     * Auto-Failover: Instant key rotation + Model fallback")
        banner.append("=" * 65)
        try:
            print("\n".join(banner), flush=True)
        except Exception:
            pass


def prune_messages_payload(content: bytes) -> bytes:
    """Safely compact large prompt/history/tool payloads from request JSON to fit within Groq's TPM limits."""
    try:
        data = json.loads(content.decode("utf-8"))
        messages = data.get("messages", [])
        if len(messages) > 3:
            # Keep system message (if present) and the latest 2 messages
            system_msgs = [m for m in messages if m.get("role") == "system"]
            non_system = [m for m in messages if m.get("role") != "system"]
            trimmed = system_msgs[:1] + non_system[-2:]
            data["messages"] = trimmed

        # Cap completion tokens to 250 so Groq doesn't reserve thousands of tokens
        data["max_completion_tokens"] = 250

        # Truncate any long message content (e.g. large tool output or prompt bloat)
        for m in data.get("messages", []):
            c = m.get("content")
            if isinstance(c, str) and len(c) > 400:
                m["content"] = c[:350] + "... [trimmed for voice agent speed]"

        return json.dumps(data).encode("utf-8")
    except Exception as e:
        logger.warning(f"Could not prune payload: {e}")
        return content


class KeyRotatingTransport(httpx.AsyncBaseTransport):
    def __init__(self, key_manager: GroqKeyManager):
        super().__init__()
        self._key_manager = key_manager
        self._transport = httpx.AsyncHTTPTransport()

    async def aclose(self) -> None:
        await self._transport.aclose()

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        # Buffer request content in memory so it can be safely re-sent upon 429/413/401
        await request.aread()

        total_keys = len(self._key_manager.keys)
        resp = None

        # Attempt across all available keys
        for attempt in range(max(1, total_keys)):
            current_key = self._key_manager.get_current_key()
            request.headers["authorization"] = f"Bearer {current_key}"

            resp = await self._transport.handle_async_request(request)

            # Check if rate limit (429) or auth error (401) occurred
            if resp.status_code in (429, 401) and total_keys > 1:
                status_reason = f"HTTP {resp.status_code}"
                await resp.aread()
                await resp.aclose()
                self._key_manager.rotate_key(reason=status_reason)
                continue

            # If 413 (Request too large for TPM limit) occurs, immediately prune context and retry!
            if resp.status_code == 413 and request.content:
                await resp.aread()
                await resp.aclose()
                print("\n✂️ [PROMPT COMPACTION]: Request exceeded Groq TPM limit (HTTP 413). Automatically compacting history & retrying...\n", flush=True)
                pruned_content = prune_messages_payload(request.content)
                if pruned_content != request.content:
                    request = httpx.Request(
                        method=request.method,
                        url=request.url,
                        headers=dict(request.headers),
                        content=pruned_content,
                    )
                    request.headers["content-length"] = str(len(pruned_content))
                    request.headers["authorization"] = f"Bearer {current_key}"
                    pruned_resp = await self._transport.handle_async_request(request)
                    if pruned_resp.status_code == 200:
                        return pruned_resp
                    resp = pruned_resp

            return resp

        # If all keys were exhausted on gpt-oss-120b or 413 persisted,
        # automatically fallback to qwen/qwen3.8-27b with pruned payload!
        if resp and resp.status_code in (429, 413) and b"openai/gpt-oss-120b" in (request.content or b""):
            try:
                print("\n🔄 [MODEL FAILOVER]: gpt-oss-120b limit reached on all keys. Compacting & falling back to qwen/qwen3.8-27b...\n", flush=True)
                pruned_content = prune_messages_payload(request.content)
                new_content = pruned_content.replace(b'"openai/gpt-oss-120b"', b'"qwen/qwen3.8-27b"')
                fallback_req = httpx.Request(
                    method=request.method,
                    url=request.url,
                    headers=dict(request.headers),
                    content=new_content,
                )
                fallback_req.headers["content-length"] = str(len(new_content))
                for attempt in range(max(1, total_keys)):
                    k = self._key_manager.get_current_key()
                    fallback_req.headers["authorization"] = f"Bearer {k}"
                    fallback_resp = await self._transport.handle_async_request(fallback_req)
                    if fallback_resp.status_code in (429, 413, 401) and total_keys > 1:
                        await fallback_resp.aread()
                        await fallback_resp.aclose()
                        self._key_manager.rotate_key(reason=f"HTTP {fallback_resp.status_code} on fallback")
                        continue
                    return fallback_resp
            except Exception as e:
                logger.error(f"Fallback model error: {e}")

        return resp


def create_groq_client(key_manager: GroqKeyManager | None = None) -> tuple[openai.AsyncClient, GroqKeyManager]:
    if key_manager is None:
        key_manager = GroqKeyManager()

    key_manager.print_status()
    transport = KeyRotatingTransport(key_manager)
    http_client = httpx.AsyncClient(transport=transport)
    client = openai.AsyncClient(
        api_key=key_manager.get_current_key() or "none",
        base_url="https://api.groq.com/openai/v1",
        http_client=http_client,
    )
    return client, key_manager
