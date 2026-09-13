import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure UTF-8 output on Windows console to prevent charmap encoding errors
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Load env variables from root .env.local or .env
root_dir = Path(__file__).parent.parent
load_dotenv(root_dir / ".env.local")
load_dotenv(root_dir / ".env")

import edge_tts
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    tts,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import groq, silero
try:
    from agent.pc_control import LAPTOP_CONTROL_TOOLS
except (ModuleNotFoundError, ImportError):
    from pc_control import LAPTOP_CONTROL_TOOLS
try:
    from agent.groq_key_manager import create_groq_client
except (ModuleNotFoundError, ImportError):
    from groq_key_manager import create_groq_client

logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)

# High-fidelity Edge Neural TTS Adapter for LiveKit
class EdgeTTS(tts.TTS):
    def __init__(self, voice: str = "en-US-JennyNeural", hindi_voice: str = "hi-IN-SwaraNeural", is_hindi: bool = False):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self.voice = voice
        self.hindi_voice = hindi_voice
        self.is_hindi = is_hindi

    def synthesize(self, text: str, *, conn_options=None) -> tts.ChunkedStream:
        has_hindi = any("\u0900" <= ch <= "\u097f" for ch in text)
        chosen_voice = self.hindi_voice if (self.is_hindi or has_hindi) else self.voice
        return EdgeChunkedStream(
            tts=self,
            input_text=text,
            conn_options=conn_options or tts.DEFAULT_API_CONNECT_OPTIONS,
            voice=chosen_voice,
        )

class EdgeChunkedStream(tts.ChunkedStream):
    def __init__(self, *args, voice: str = "en-US-JennyNeural", **kwargs):
        super().__init__(*args, **kwargs)
        self.chosen_voice = voice

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        communicate = edge_tts.Communicate(self.input_text, self.chosen_voice)
        output_emitter.initialize(
            request_id="edge_tts",
            sample_rate=24000,
            num_channels=1,
            mime_type="audio/mp3",
        )
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                output_emitter.push(chunk["data"])
        output_emitter.flush()

SYSTEM_PROMPT = """You are an intelligent, friendly AI voice assistant built with LiveKit Agents that has voice control capabilities over the user's Windows laptop.
You communicate naturally through voice.

DYNAMIC COMMAND CREATION & EXECUTION (VERY IMPORTANT):
You have the ability to automatically create and execute Windows PowerShell commands to fulfill any task requested by the user.
Whenever the user asks you to:
- Run a command, execute a script, or perform any command-line task
- Create, modify, delete, find, or list files or folders (e.g. "create a folder on my desktop called projects", "list files in my downloads")
- Check disk space, drive usage, or system storage (e.g. "check free space on drive C")
- Check networking, WiFi details, ping websites, or find IP address (e.g. "what is my IP address?", "ping google.com")
- Query active processes, hardware stats, or system info (e.g. "what apps are using the most RAM?")
- Any other PC action not covered by built-in tools
👉 IMMEDIATELY formulate the safe Windows PowerShell command and call `run_terminal_command(command=..., description=...)`!
When you receive the command output, summarize the result into 1 or 2 spoken sentences for the user.

BUILT-IN TOOLS:
- Open an application (notepad, chrome, calculator, vs code, settings, etc.) -> call `open_application`
- Close an app -> call `close_application`
- Open a website (YouTube, GitHub, etc.) -> call `open_website`
- Search something -> call `search_web`
- Write or take a note -> call `write_note` (saves the note and opens it in Notepad)
- Adjust volume (up, down, mute) -> call `volume_control`
- Control media (play, pause, next) -> call `media_control`
- Take a screenshot -> call `take_screenshot`
- Check battery / system specs -> call `get_system_status`
- Lock laptop -> call `lock_laptop`

VOICE RESPONSE RULES:
- Always call the tool FIRST to perform the action.
- Keep your spoken responses concise, conversational, and direct (1 to 2 sentences).
- Avoid long lists, markdown formatting, or bullet points in spoken responses.
- LANGUAGE SUPPORT: If the user speaks in Hindi, respond in Hindi. If the user speaks in English, respond in English.
"""

HINDI_SYSTEM_PROMPT = """You are an intelligent, friendly AI voice assistant built with LiveKit Agents that has voice control capabilities over the user's Windows laptop.
You communicate naturally through voice.

CRITICAL LANGUAGE INSTRUCTION:
The user has chosen HINDI language mode.
- You MUST always speak and reply in natural, friendly HINDI (Devanagari script or conversational Hindi).
- If the user refers to technical terms or apps (like Notepad, Chrome, YouTube, Calculator, Volume, Screenshot, Folder, File, etc.), use them naturally within your Hindi speech.
- Keep your spoken answers concise, conversational, and direct (1 to 2 spoken sentences in Hindi).
Examples:
- "नमस्ते! मैं आपका AI वॉयस असिस्टेंट हूँ। मैं आपके लैपटॉप पर क्या करूँ?"
- "मैंने आपके लिए Notepad खोल दिया है।"
- "मैंने आवाज़ बढ़ा दी है।"
- "YouTube खुल गया है।"
- "मैंने आपका नोट Notepad में लिख कर सेव कर दिया है।"
- "मैंने आपके डेस्कटॉप का स्क्रीनशॉट ले लिया है।"
- "C ड्राइव में 120 GB स्पेस खाली है।"

DYNAMIC COMMAND CREATION & EXECUTION (VERY IMPORTANT):
You have the ability to automatically create and execute Windows PowerShell commands to fulfill any task requested by the user.
Whenever the user asks you to:
- Run a command, execute a script, or perform any command-line task
- Create, modify, delete, find, or list files or folders (e.g. "डेस्कटॉप पर projects नाम का फ़ोल्डर बनाओ", "downloads में फ़ाइलें दिखाओ")
- Check disk space, drive usage, or system storage (e.g. "C ड्राइव में कितना स्पेस खाली है")
- Check networking, WiFi details, ping websites, or find IP address (e.g. "मेरा IP एड्रेस क्या है?", "गूगल पिंग करो")
- Query active processes, hardware stats, or system info (e.g. "कौन से ऐप्स सबसे ज्यादा रैम ले रहे हैं?")
- Any other PC action not covered by built-in tools
👉 IMMEDIATELY formulate the safe Windows PowerShell command and call `run_terminal_command(command=..., description=...)`!
When you receive the command output, summarize the result into 1 or 2 spoken sentences in Hindi for the user.

BUILT-IN TOOLS:
- Open an application (notepad, chrome, calculator, vs code, settings, etc.) -> call `open_application`
- Close an app -> call `close_application`
- Open a website (YouTube, GitHub, etc.) -> call `open_website`
- Search something -> call `search_web`
- Write or take a note -> call `write_note` (saves the note and opens it in Notepad)
- Adjust volume (up, down, mute) -> call `volume_control`
- Control media (play, pause, next) -> call `media_control`
- Take a screenshot -> call `take_screenshot`
- Check battery / system specs -> call `get_system_status`
- Lock laptop -> call `lock_laptop`

VOICE RESPONSE RULES:
- Always call the tool FIRST to perform the action.
- Keep your spoken responses concise, conversational, and direct (1 to 2 sentences) in natural Hindi.
- Avoid long lists, markdown formatting, or bullet points in spoken responses—speak plain conversational Hindi.
"""

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Wait for the user participant to connect and extract language preference
    logger.info("Waiting for user participant to detect language preference...")
    user_lang = "en"
    try:
        user_participant = await ctx.wait_for_participant()
        # 1. Check participant attributes
        if hasattr(user_participant, "attributes") and user_participant.attributes:
            lang_attr = user_participant.attributes.get("language")
            if lang_attr:
                user_lang = lang_attr.lower()

        # 2. Check participant metadata
        if user_lang == "en" and hasattr(user_participant, "metadata") and user_participant.metadata:
            try:
                meta = json.loads(user_participant.metadata)
                if isinstance(meta, dict) and "language" in meta:
                    user_lang = meta["language"].lower()
            except Exception:
                if "hi" in user_participant.metadata.lower():
                    user_lang = "hi"
    except Exception as e:
        logger.warning(f"Could not extract participant language: {e}")

    is_hindi = (user_lang == "hi")
    lang_display = "HINDI (हिन्दी)" if is_hindi else "ENGLISH"
    print(f"\n🌐 [SESSION LANGUAGE DETECTED]: {lang_display}\n", flush=True)
    logger.info(f"Session language: {lang_display}")

    # Initialize VAD (Voice Activity Detection) with noise-resilient parameters
    vad = silero.VAD.load(
        activation_threshold=0.6,    # Rejects low-level room noise, breathing, fan hums
        min_speech_duration=0.1,     # Rejects transient impulse noise (<100ms) such as clicks/clatter
        min_silence_duration=0.55,   # Natural conversational endpointing
        prefix_padding_duration=0.4, # Preserves starting word phonemes
    )

    # Initialize multi-key Groq client with auto-failover on rate limit (429)
    groq_client, _ = create_groq_client()

    # Initialize Groq STT and LLM with key failover
    stt = groq.STT(
        model="whisper-large-v3-turbo",
        client=groq_client,
        language="hi" if is_hindi else "en",
    )
    llm = groq.LLM(
        model="openai/gpt-oss-120b",
        client=groq_client,
        max_completion_tokens=250,
    )

    # Configure TTS: Use OpenAI if available, else Edge Neural TTS (supports English & Hindi)
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and len(openai_key.strip()) > 10:
        from livekit.plugins import openai
        logger.info("Using OpenAI TTS")
        agent_tts = openai.TTS(voice="alloy")
    else:
        chosen_voice = "hi-IN-SwaraNeural" if is_hindi else "en-US-JennyNeural"
        logger.info(f"Using Microsoft Edge Neural TTS ({chosen_voice})")
        agent_tts = EdgeTTS(voice=chosen_voice, hindi_voice="hi-IN-SwaraNeural", is_hindi=is_hindi)

    # Select system prompt instructions based on language
    chosen_instructions = HINDI_SYSTEM_PROMPT if is_hindi else SYSTEM_PROMPT

    # Create Agent instance with Laptop Control tools
    agent = Agent(
        instructions=chosen_instructions,
        tools=LAPTOP_CONTROL_TOOLS,
    )

    # Create Agent Session with noise resilience and false-interruption protection
    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=agent_tts,
        vad=vad,
        min_interruption_duration=0.4,   # Ignore brief acoustic noise bursts while agent speaks
        min_interruption_words=2,        # Require at least 2 words before interrupting agent
        resume_false_interruption=True,  # Auto-resume speech if interruption had no valid speech words
        false_interruption_timeout=2.0,  # Evaluation window for false interruptions
        aec_warmup_duration=0.5,         # Acoustic echo cancellation warmup
    )

    # Real-time Terminal Logging Listeners
    @session.on("user_input_transcribed")
    def on_user_input(ev):
        if ev.is_final and ev.transcript.strip():
            print(f"\n🗣️  [USER SPOKE]: \"{ev.transcript.strip()}\"", flush=True)

    @session.on("conversation_item_added")
    def on_conv_item(ev):
        item = ev.item
        role = getattr(item, "role", "")
        text = getattr(item, "text_content", "") or ""
        if str(role).lower() == "assistant" and text.strip():
            print(f"🤖 [AGENT REPLIED]: \"{text.strip()}\"\n", flush=True)

        # Truncate context to last 4 items so token consumption stays low across long conversations
        try:
            session.history.truncate(max_items=4)
        except Exception:
            pass

    @session.on("error")
    def on_session_error(err):
        print(f"\n⚠️  [SESSION EVENT]: {err}\n", flush=True)
        logger.warning(f"LiveKit session error: {err}")

    # Start the agent session attached to the room
    banner = f"""
=================================================================
  🎙️  LIVEKIT AI VOICE AGENT WORKER IS ACTIVE & READY!
  🌐 Active Language Mode: {lang_display}
  💻 Laptop Voice Control & Dynamic Command Engine Loaded:
     • Dynamic PowerShell Command Generation & Execution (Auto)
     • Open / Close Apps (Notepad, Chrome, Calc, VS Code, etc.)
     • Write Notes (Auto-saves & opens in Notepad)
     • Open Websites & Search Web / YouTube
     • Volume Control & Media Playback
     • Screenshots & System / Battery Status
     • Workstation Lock
     • AI Noise Cancellation & Interruption Shield: Active (Krisp + Hardened VAD)
=================================================================
"""
    print(banner, flush=True)
    logger.info("Starting voice agent session with laptop control tools...")
    await session.start(agent, room=ctx.room)

    # Send initial greeting once user joins
    await asyncio.sleep(0.5)
    try:
        if is_hindi:
            await session.say("नमस्ते! मैं आपका AI वॉयस असिस्टेंट हूँ। मैं आपके लैपटॉप पर क्या करूँ?")
        else:
            await session.say("Hi there! I am your AI voice assistant with full laptop control. What would you like me to do?")
    except Exception as e:
        logger.warning(f"Initial greeting notice: {e}")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
