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
import threading
import warnings

# Forcer l'encodage UTF-8 pour stdin et stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

# Masquer les warnings PyTorch/CUDA pour préserver la propreté du flux JSON
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np

WAKE_WORDS = ['eva', 'éva', 'hey eva', 'e.v.a', 'eh va', 'eva,', 'éva,']
INITIAL_PROMPT = "Bonjour Eva. Test 1 2 3, un deux trois. Comment vas-tu ? Active CloudWorks."

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
        try:
            sys.stderr.write(f"[Whisper] GPU dédié détecté : {hw['gpu_name']} ({hw['vram_gb']} Go VRAM). Chargement CUDA float16...\n")
            model = faster_whisper.WhisperModel("tiny", device="cuda", compute_type="float16")
            device = "cuda"
            compute_type = "float16"
        except Exception as e:
            sys.stderr.write(f"[Whisper] Échec CUDA ({e}). Bascule sécurisée sur CPU int8...\n")
            device = "cpu"
            compute_type = "int8"
            model = faster_whisper.WhisperModel("tiny", device="cpu", compute_type="int8", cpu_threads=hw["cpu_threads"])
    else:
        sys.stderr.write(f"[Whisper] Mode CPU int8 optimisé ({hw['cpu_threads']} threads, 0 ralentissement système)...\n")
        model = faster_whisper.WhisperModel("tiny", device="cpu", compute_type="int8", cpu_threads=hw["cpu_threads"])

    send_json({
        "type": "ready",
        "device": device,
        "compute_type": compute_type,
        "model": "tiny",
        "cpu_threads": hw["cpu_threads"],
        "gpu_name": hw["gpu_name"]
    })

    SAMPLE_RATE = 16000
    BLOCK_SIZE = 1600
    audio_queue = queue.Queue()
    is_paused = False
    is_running = True

    def audio_callback(indata, frames, time_info, status):
        if not is_paused and is_running:
            audio_queue.put(indata.copy())

    def stdin_listener():
        nonlocal is_paused, is_running
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
                    while not audio_queue.empty():
                        try: audio_queue.get_nowait()
                        except: break
                elif cmd == "resume":
                    is_paused = False
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
    speech_blocks = []
    in_speech = False
    silence_blocks_count = 0
    SILENCE_THRESHOLD_BLOCKS = 7
    NOISE_FLOOR = 0.005
    last_interim_time = 0

    try:
        while is_running:
            try:
                block = audio_queue.get(timeout=0.2)
            except queue.Empty:
                continue

            flat = block.flatten()
            rms = float(np.sqrt(np.mean(flat**2)))

            if not in_speech:
                NOISE_FLOOR = min(max(0.001, NOISE_FLOOR * 0.99 + rms * 0.01), 0.05)
                vad_threshold = max(0.012, NOISE_FLOOR * 2.8)
            else:
                vad_threshold = max(0.010, NOISE_FLOOR * 2.2)

            if rms > vad_threshold:
                silence_blocks_count = 0
                if not in_speech:
                    in_speech = True
                    speech_blocks = list(pre_speech_blocks)
                    last_interim_time = time.time()
                speech_blocks.append(flat)
            else:
                if in_speech:
                    speech_blocks.append(flat)
                    silence_blocks_count += 1
                    if silence_blocks_count >= SILENCE_THRESHOLD_BLOCKS:
                        total_samples = sum(len(b) for b in speech_blocks)
                        duration_sec = total_samples / SAMPLE_RATE

                        if duration_sec >= 0.35:
                            audio_data = np.concatenate(speech_blocks)
                            try:
                                segments, _ = model.transcribe(
                                    audio_data,
                                    language="fr",
                                    initial_prompt=INITIAL_PROMPT,
                                    beam_size=1,
                                    vad_filter=False
                                )
                                final_text = " ".join([s.text for s in segments]).strip()
                                if final_text:
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

                        in_speech = False
                        speech_blocks = []
                        silence_blocks_count = 0
                else:
                    pre_speech_blocks.append(flat)
                    if len(pre_speech_blocks) > MAX_PRE_SPEECH:
                        pre_speech_blocks.pop(0)

            # Sur GPU uniquement : prévisualisation intermédiaire toutes les 500ms
            # Sur CPU : préservé à 100% en n'exécutant l'inférence qu'à la fin de phrase
            if device == "cuda" and in_speech and (time.time() - last_interim_time > 0.5):
                last_interim_time = time.time()
                total_samples = sum(len(b) for b in speech_blocks)
                if total_samples / SAMPLE_RATE >= 0.6:
                    audio_data = np.concatenate(speech_blocks)
                    try:
                        segments, _ = model.transcribe(
                            audio_data,
                            language="fr",
                            initial_prompt=INITIAL_PROMPT,
                            beam_size=1,
                            vad_filter=False
                        )
                        interim_text = " ".join([s.text for s in segments]).strip()
                        if interim_text:
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
