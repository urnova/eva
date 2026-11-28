#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
EVA Whisper Service — Moteur STT et Wake Word Multiplateforme
Détection automatique intelligente du matériel (GPU dédié vs CPU léger).
Sur GPU dédié : CUDA float16 ultra-rapide avec streaming en direct.
Sur CPU / configuration modeste : int8 optimisé, threads limités pour 0 ralentissement.
Communication bidirectionnelle via JSON-Lines sur stdin / stdout.
"""

import sys
import os
import io
import json
import time
import queue
import shutil
import threading
import warnings

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
if sys.platform == "win32":
    _orig_symlink = os.symlink
    def _safe_symlink(src, dst, target_is_directory=False, *args, **kwargs):
        try:
            return _orig_symlink(src, dst, target_is_directory=target_is_directory, *args, **kwargs)
        except OSError:
            real_src = src if os.path.isabs(src) else os.path.normpath(os.path.join(os.path.dirname(dst), src))
            if os.path.isdir(real_src):
                if os.path.exists(dst):
                    shutil.rmtree(dst, ignore_errors=True)
                shutil.copytree(real_src, dst)
            else:
                shutil.copy2(real_src, dst)
    os.symlink = _safe_symlink

# Forcer l'encodage UTF-8 pour stdin et stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

# Masquer les warnings PyTorch/CUDA pour préserver la propreté du flux JSON
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np

WAKE_WORDS = ['eva', 'éva', 'hey eva', 'e.v.a', 'eh va', 'eva,', 'éva,']
INITIAL_PROMPT = None

HALLUCINATIONS = {
    "merci", "merci.", "merci beaucoup", "merci beaucoup.",
    "merci d'avoir regardé", "merci d'avoir regarde",
    "sous-titres", "sous-titres réalisés", "amara.org",
    "test 1 2 3", "un deux trois", "active cloudworks",
    "c'est parti", "...", ".", "!", "?"
}

def set_low_priority():
    """Abaisse la priorité du processus pour ne jamais ralentir le système (jeux, navigation, etc.)."""
    try:
        if sys.platform == 'win32':
            import ctypes
            # BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
            ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
    except Exception:
        pass

def detect_hardware():
    """Détecte les capacités CPU et GPU du système."""
    cpu_count = os.cpu_count() or 4
    # Limiter les threads CPU (min 1, max 4) pour préserver la fluidité de Windows
    optimal_threads = max(1, min(4, cpu_count // 2))

    gpu_available = False
    gpu_name = None
    vram_gb = 0.0

    try:
        import torch
        if torch.cuda.is_available() and torch.cuda.device_count() > 0:
            gpu_name = torch.cuda.get_device_name(0)
            vram_bytes = torch.cuda.get_device_properties(0).total_memory
            vram_gb = round(vram_bytes / (1024**3), 1)
            # Requis : au moins 2.0 Go de VRAM dédiée pour garantir la stabilité avec les autres apps
            if vram_gb >= 2.0:
                gpu_available = True
    except Exception:
        pass

    return {
        "cpu_threads": optimal_threads,
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb
    }

def send_json(data):
    """Envoie un message JSON sur stdout avec flush immédiat."""
    try:
        line = json.dumps(data, ensure_ascii=False)
        sys.stdout.write(line + '\n')
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"[Service Error] send_json: {e}\n")

def check_wakeword(text):
    """Vérifie si le texte contient un mot de réveil et extrait la commande associée."""
    if not text:
        return False, None
    lower = text.lower().strip()
    best_idx = -1
    best_len = 0
    matched_word = None
    for w in WAKE_WORDS:
        idx = lower.find(w)
        if idx != -1 and len(w) > best_len:
            best_idx = idx
            best_len = len(w)
            matched_word = w
    
    if best_idx != -1:
        after = lower[best_idx + best_len:].strip()
        while after and after[0] in ',.?!;: ':
            after = after[1:].strip()
        return True, after if after else None
    return False, None

def main():
    set_low_priority()
    hw = detect_hardware()

    import sounddevice as sd
    import faster_whisper

    device = "cpu"
    compute_type = "int8"
    model = None

    if hw["gpu_available"]:
        for cand in ("small", "tiny"):
            try:
                sys.stderr.write(f"[Whisper] GPU dédié détecté : {hw['gpu_name']} ({hw['vram_gb']} Go VRAM). Chargement '{cand}' CUDA float16...\n")
                model = faster_whisper.WhisperModel(cand, device="cuda", compute_type="float16")
                device = "cuda"
                compute_type = "float16"
                model_name = cand
                break
            except Exception as e:
                sys.stderr.write(f"[Whisper] Échec CUDA '{cand}' ({e}).\n")
        if model is None:
            device = "cpu"
            compute_type = "int8"
            for cand in ("base", "tiny"):
                try:
                    model_name = cand
                    model = faster_whisper.WhisperModel(cand, device="cpu", compute_type="int8", cpu_threads=hw["cpu_threads"])
                    break
                except Exception as e2:
                    sys.stderr.write(f"[Whisper] Échec CPU '{cand}' ({e2}).\n")
    else:
        for cand in ("base", "tiny"):
            try:
                sys.stderr.write(f"[Whisper] Mode CPU '{cand}' int8 optimisé ({hw['cpu_threads']} threads)...\n")
                model_name = cand
                model = faster_whisper.WhisperModel(cand, device="cpu", compute_type="int8", cpu_threads=hw["cpu_threads"])
                break
            except Exception as e2:
                sys.stderr.write(f"[Whisper] Échec CPU '{cand}' ({e2}).\n")

    if model is None:
        send_json({"type": "error", "message": "Impossible de charger un modèle Whisper."})
        return

    send_json({
        "type": "ready",
        "device": device,
        "compute_type": compute_type,
        "model": model_name,
        "cpu_threads": hw["cpu_threads"],
        "gpu_name": hw["gpu_name"]
    })

    SAMPLE_RATE = 16000
    BLOCK_SIZE = 1600
    audio_queue = queue.Queue()
    is_paused = False
    is_running = True
    reset_requested = False

    def audio_callback(indata, frames, time_info, status):
        if not is_paused and is_running:
            audio_queue.put(indata.copy())

    def flush_audio_queue():
        while not audio_queue.empty():
            try:
                audio_queue.get_nowait()
            except Exception:
                break

    def stdin_listener():
        nonlocal is_paused, is_running, reset_requested
        while is_running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                cmd_data = json.loads(line)
                cmd = cmd_data.get("command")
                if cmd == "pause":
                    is_paused = True
                    reset_requested = True
                    flush_audio_queue()
                elif cmd == "resume":
                    flush_audio_queue()
                    reset_requested = True
                    is_paused = False
                elif cmd == "reset":
                    flush_audio_queue()
                    reset_requested = True
                elif cmd == "stop":
                    is_running = False
                    break
            except Exception:
                pass

    t_stdin = threading.Thread(target=stdin_listener, daemon=True)
    t_stdin.start()

    try:
        stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='float32',
            blocksize=BLOCK_SIZE,
            callback=audio_callback
        )
        stream.start()
    except Exception as e:
        send_json({"type": "error", "message": f"Impossible d'ouvrir le micro: {e}"})
        return

    pre_speech_blocks = []
    MAX_PRE_SPEECH = 4
    MAX_SPEECH_SAMPLES = SAMPLE_RATE * 14
    speech_blocks = []
    in_speech = False
    silence_blocks_count = 0
    SILENCE_THRESHOLD_BLOCKS = 8
    NOISE_FLOOR = 0.005
    peak_rms = 0.0
    speech_started_at = 0.0
    last_interim_time = 0

    def reset_utterance_state():
        nonlocal in_speech, speech_blocks, pre_speech_blocks, silence_blocks_count, peak_rms, speech_started_at
        in_speech = False
        speech_blocks = []
        pre_speech_blocks = []
        silence_blocks_count = 0
        peak_rms = 0.0
        speech_started_at = 0.0

    def filter_segments(segments, seg_peak_rms):
        kept = []
        for s in segments:
            txt = (s.text or "").strip()
            if not txt:
                continue
            if getattr(s, "no_speech_prob", 0.0) > 0.60:
                continue
            if getattr(s, "avg_logprob", 0.0) < -1.05:
                continue
            if getattr(s, "compression_ratio", 1.0) > 2.2:
                continue
            low = txt.lower().strip()
            if any(bad in low for bad in ("sous-titr", "amara.org", "merci d'avoir regard", "test 1 2 3")):
                continue
            if low in HALLUCINATIONS and seg_peak_rms < max(0.025, NOISE_FLOOR * 4.0):
                continue
            kept.append(txt)
        return " ".join(kept).strip()

    try:
        while is_running:
            if reset_requested:
                reset_requested = False
                reset_utterance_state()
                flush_audio_queue()
            try:
                block = audio_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            if is_paused or reset_requested:
                if reset_requested:
                    reset_requested = False
                reset_utterance_state()
                continue

            flat = block.flatten()
            rms = float(np.sqrt(np.mean(flat**2)))

            if not in_speech:
                NOISE_FLOOR = min(max(0.001, NOISE_FLOOR * 0.99 + rms * 0.01), 0.05)
                vad_threshold = max(0.018, NOISE_FLOOR * 3.5)
            else:
                if speech_started_at and (time.time() - speech_started_at > 4.0) and rms < max(peak_rms * 0.35, 0.035):
                    NOISE_FLOOR = min(0.05, max(NOISE_FLOOR, NOISE_FLOOR * 0.96 + rms * 0.04))
                vad_threshold = max(0.013, NOISE_FLOOR * 2.5)

            if rms > vad_threshold:
                silence_blocks_count = 0
                if not in_speech:
                    in_speech = True
                    speech_started_at = time.time()
                    peak_rms = rms
                    speech_blocks = list(pre_speech_blocks)
                    last_interim_time = time.time()
                elif rms > peak_rms:
                    peak_rms = rms
                speech_blocks.append(flat)
            else:
                if in_speech:
                    speech_blocks.append(flat)
                    silence_blocks_count += 1
                else:
                    pre_speech_blocks.append(flat)
                    if len(pre_speech_blocks) > MAX_PRE_SPEECH:
                        pre_speech_blocks.pop(0)

            total_samples = sum(len(b) for b in speech_blocks) if in_speech else 0
            should_finalize = in_speech and (
                silence_blocks_count >= SILENCE_THRESHOLD_BLOCKS or total_samples >= MAX_SPEECH_SAMPLES
            )
            if should_finalize:
                duration_sec = total_samples / SAMPLE_RATE
                if duration_sec >= 0.45 and peak_rms >= max(0.020, NOISE_FLOOR * 3.5):
                    audio_data = np.concatenate(speech_blocks)
                    try:
                        segments, _ = model.transcribe(
                            audio_data,
                            language="fr",
                            initial_prompt=INITIAL_PROMPT,
                            condition_on_previous_text=False,
                            beam_size=2 if device == "cuda" else 1,
                            vad_filter=True,
                            vad_parameters={"min_silence_duration_ms": 400, "speech_pad_ms": 180}
                        )
                        final_text = filter_segments(segments, peak_rms)
                        if final_text and not reset_requested and not is_paused:
                            has_ww, cmd = check_wakeword(final_text)
                            send_json({
                                "type": "final",
                                "text": final_text,
                                "hasWakeWord": has_ww,
                                "command": cmd
                            })
                            if has_ww:
                                send_json({
                                    "type": "wakeword",
                                    "phrase": final_text,
                                    "command": cmd or ""
                                })
                    except Exception as e:
                        sys.stderr.write(f"[Transcribe Error] {e}\n")
                reset_utterance_state()
                continue

            # Sur GPU uniquement : prévisualisation intermédiaire toutes les 500ms
            # Sur CPU : préservé à 100% en n'exécutant l'inférence qu'à la fin de phrase
            if device == "cuda" and in_speech and not reset_requested and not is_paused and (time.time() - last_interim_time > 0.5):
                last_interim_time = time.time()
                if total_samples / SAMPLE_RATE >= 0.6 and peak_rms >= max(0.020, NOISE_FLOOR * 3.5):
                    audio_data = np.concatenate(speech_blocks)
                    try:
                        segments, _ = model.transcribe(
                            audio_data,
                            language="fr",
                            initial_prompt=INITIAL_PROMPT,
                            condition_on_previous_text=False,
                            beam_size=1,
                            vad_filter=True,
                            vad_parameters={"min_silence_duration_ms": 400, "speech_pad_ms": 180}
                        )
                        interim_text = filter_segments(segments, peak_rms)
                        if interim_text and not reset_requested and not is_paused:
                            send_json({"type": "interim", "text": interim_text})
                    except Exception:
                        pass

    finally:
        try:
            stream.stop()
            stream.close()
        except Exception:
            pass

if __name__ == '__main__':
    main()
