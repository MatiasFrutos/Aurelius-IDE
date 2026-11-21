// src/services/voice.service.js — voz local en Linux (grabación, transcripción y lectura en voz alta)
import { invoke } from "@tauri-apps/api/core";

export const voiceTools = () => invoke("voice_tools");
export const voiceRecordStart = () => invoke("voice_record_start");
export const voiceRecordStop = (lang, model) => invoke("voice_record_stop", { lang, model: model || null });
export const voiceRecordCancel = () => invoke("voice_record_cancel");
export const voiceSpeak = (text, lang, rate) => invoke("voice_speak", { text, lang, rate });
export const voiceStopSpeaking = () => invoke("voice_stop_speaking");
