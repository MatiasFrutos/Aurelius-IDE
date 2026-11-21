// src-tauri/src/core/voice.rs
// Voz en Linux sin depender del WebView (WebKitGTK no trae reconocimiento de voz):
// - Grabación con pw-record / parecord / arecord.
// - Transcripción local con whisper.cpp (whisper-cli / whisper-cpp) o el CLI `whisper` de Python.
// - Lectura en voz alta con spd-say / espeak-ng / espeak.
// Solo se ejecutan binarios de una lista blanca; el texto y los parámetros se validan.
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

const RECORDERS: &[&str] = &["pw-record", "parecord", "arecord"];
const SPEAKERS: &[&str] = &["spd-say", "espeak-ng", "espeak"];
const TRANSCRIBERS: &[&str] = &["whisper-cli", "whisper-cpp", "whisper"];
const TRANSCRIBE_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_SPEAK_CHARS: usize = 5000;
const MAX_STT_OUTPUT: usize = 256 * 1024;

#[derive(Debug, Clone, Serialize, Default)]
pub struct VoiceTools {
    pub recorder: Option<String>,
    pub speaker: Option<String>,
    pub transcriber: Option<String>,
}

struct Recording {
    child: Child,
    wav: PathBuf,
}

#[derive(Default)]
pub struct VoiceState {
    recording: Mutex<Option<Recording>>,
    speaking: Mutex<Option<Child>>,
}

pub fn find_in_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;

    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
}

fn first_available(names: &[&str]) -> Option<String> {
    names
        .iter()
        .find(|name| find_in_path(name).is_some())
        .map(|name| name.to_string())
}

pub fn detect_tools() -> VoiceTools {
    VoiceTools {
        recorder: first_available(RECORDERS),
        speaker: first_available(SPEAKERS),
        transcriber: first_available(TRANSCRIBERS),
    }
}

fn valid_lang(lang: &str) -> bool {
    let bytes = lang.as_bytes();

    match bytes.len() {
        2 => bytes.iter().all(|b| b.is_ascii_lowercase()),
        5 => {
            bytes[..2].iter().all(|b| b.is_ascii_lowercase())
                && bytes[2] == b'-'
                && bytes[3..].iter().all(|b| b.is_ascii_alphabetic())
        }
        _ => false,
    }
}

/* ------------------------------------------------------------------ */
/* Grabación                                                           */
/* ------------------------------------------------------------------ */

fn recorder_args(tool: &str, wav: &Path) -> Vec<String> {
    let file = wav.to_string_lossy().to_string();

    match tool {
        "pw-record" => ["--rate", "16000", "--channels", "1", "--format", "s16"]
            .iter()
            .map(|s| s.to_string())
            .chain(std::iter::once(file))
            .collect(),
        "parecord" => ["--rate=16000", "--channels=1", "--format=s16le", "--file-format=wav"]
            .iter()
            .map(|s| s.to_string())
            .chain(std::iter::once(file))
            .collect(),
        _ => ["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "wav"]
            .iter()
            .map(|s| s.to_string())
            .chain(std::iter::once(file))
            .collect(),
    }
}

pub fn start_recording(state: &VoiceState) -> Result<(), String> {
    let mut guard = state.recording.lock().map_err(|_| "Estado de voz bloqueado.".to_string())?;

    if guard.is_some() {
        return Err("Ya hay una grabación en curso.".to_string());
    }

    let tool = first_available(RECORDERS)
        .ok_or_else(|| "No hay grabador de audio (instalá pipewire, pulseaudio-utils o alsa-utils).".to_string())?;

    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let wav = std::env::temp_dir().join(format!("aurelius-voice-{}-{nanos}.wav", std::process::id()));

    let child = Command::new(&tool)
        .args(recorder_args(&tool, &wav))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("No se pudo iniciar {tool}: {error}"))?;

    *guard = Some(Recording { child, wav });

    Ok(())
}

fn interrupt_and_wait(child: &mut Child) {
    // SIGINT para que el grabador cierre bien la cabecera del WAV.
    let _ = Command::new("kill")
        .args(["-INT", &child.id().to_string()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    let started = Instant::now();

    while started.elapsed() < Duration::from_secs(3) {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return;
        }

        thread::sleep(Duration::from_millis(40));
    }

    let _ = child.kill();
    let _ = child.wait();
}

pub fn stop_recording(state: &VoiceState) -> Result<PathBuf, String> {
    let recording = state
        .recording
        .lock()
        .map_err(|_| "Estado de voz bloqueado.".to_string())?
        .take()
        .ok_or_else(|| "No hay una grabación en curso.".to_string())?;

    let Recording { mut child, wav } = recording;

    interrupt_and_wait(&mut child);

    let size = fs::metadata(&wav).map(|m| m.len()).unwrap_or(0);

    if size < 1024 {
        let _ = fs::remove_file(&wav);
        return Err("No se grabó audio (¿micrófono silenciado o sin permisos?).".to_string());
    }

    Ok(wav)
}

pub fn cancel_recording(state: &VoiceState) {
    if let Ok(mut guard) = state.recording.lock() {
        if let Some(Recording { mut child, wav }) = guard.take() {
            interrupt_and_wait(&mut child);
            let _ = fs::remove_file(wav);
        }
    }
}

/* ------------------------------------------------------------------ */
/* Transcripción                                                       */
/* ------------------------------------------------------------------ */

fn run_capture(mut command: Command) -> Result<String, String> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("No se pudo ejecutar el transcriptor: {error}"))?;

    let mut stdout = child.stdout.take().ok_or_else(|| "Sin salida del transcriptor.".to_string())?;

    let reader = thread::spawn(move || {
        let mut data = Vec::new();
        let mut buffer = [0_u8; 8192];

        while let Ok(size) = stdout.read(&mut buffer) {
            if size == 0 || data.len() + size > MAX_STT_OUTPUT {
                break;
            }

            data.extend_from_slice(&buffer[..size]);
        }

        data
    });

    let started = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() > TRANSCRIBE_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("La transcripción tardó demasiado.".to_string());
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(error) => return Err(format!("Error esperando al transcriptor: {error}")),
        }
    }

    let data = reader.join().unwrap_or_default();

    Ok(String::from_utf8_lossy(&data).to_string())
}

// Quita marcas de tiempo de whisper.cpp («[00:00:00.000 --> 00:00:02.000]») y espacios sobrantes.
pub fn clean_transcript(raw: &str) -> String {
    raw.lines()
        .map(|line| {
            let line = line.trim();

            match (line.starts_with('['), line.find(']')) {
                (true, Some(end)) => line[end + 1..].trim(),
                _ => line,
            }
        })
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn transcribe(wav: &Path, lang: &str, model: &str) -> Result<String, String> {
    if !valid_lang(lang) {
        let _ = fs::remove_file(wav);
        return Err("Idioma de voz inválido.".to_string());
    }

    let short_lang = &lang[..2];
    let tool = first_available(TRANSCRIBERS).ok_or_else(|| {
        let _ = fs::remove_file(wav);
        "No hay transcriptor local (instalá whisper.cpp: whisper-cli, o `pip install openai-whisper`).".to_string()
    })?;

    let result = if tool == "whisper" {
        // CLI de Python: escribe <nombre>.txt en --output_dir.
        let out_dir = std::env::temp_dir();
        let model_name = if model.trim().is_empty() { "base" } else { model.trim() };

        if !model_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_') {
            let _ = fs::remove_file(wav);
            return Err("Nombre de modelo inválido.".to_string());
        }

        let mut command = Command::new(&tool);
        command
            .arg(wav)
            .args(["--language", short_lang, "--model", model_name, "--output_format", "txt", "--fp16", "False"])
            .arg("--output_dir")
            .arg(&out_dir);

        run_capture(command).and_then(|_| {
            let txt = out_dir.join(format!("{}.txt", wav.file_stem().and_then(|s| s.to_str()).unwrap_or("out")));
            let text = fs::read_to_string(&txt).map_err(|error| format!("Sin resultado de whisper: {error}"));
            let _ = fs::remove_file(&txt);
            text
        })
    } else {
        // whisper.cpp: requiere un modelo ggml existente.
        let model_path = Path::new(model.trim());

        if model.trim().is_empty() || !model_path.is_file() {
            let _ = fs::remove_file(wav);
            return Err("Indicá la ruta de un modelo ggml de whisper.cpp en Ajustes → Voz.".to_string());
        }

        let mut command = Command::new(&tool);
        command
            .arg("-m")
            .arg(model_path)
            .arg("-f")
            .arg(wav)
            .args(["-l", short_lang, "-nt", "-np"]);

        run_capture(command)
    };

    let _ = fs::remove_file(wav);

    result.map(|raw| clean_transcript(&raw))
}

/* ------------------------------------------------------------------ */
/* Lectura en voz alta                                                 */
/* ------------------------------------------------------------------ */

pub fn sanitize_speech(text: &str) -> String {
    text.chars()
        .map(|c| if c.is_control() && c != '\n' { ' ' } else { c })
        .take(MAX_SPEAK_CHARS)
        .collect::<String>()
        .trim()
        .to_string()
}

pub fn stop_speaking(state: &VoiceState) {
    if let Ok(mut guard) = state.speaking.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn speak(state: &VoiceState, text: &str, lang: &str, rate: f32) -> Result<(), String> {
    if !valid_lang(lang) {
        return Err("Idioma de voz inválido.".to_string());
    }

    let clean = sanitize_speech(text);

    if clean.is_empty() {
        return Ok(());
    }

    let tool = first_available(SPEAKERS)
        .ok_or_else(|| "No hay sintetizador de voz (instalá speech-dispatcher o espeak-ng).".to_string())?;

    stop_speaking(state);

    let rate = if rate.is_finite() { rate.clamp(0.5, 2.0) } else { 1.0 };
    let mut command = Command::new(&tool);

    if tool == "spd-say" {
        command.args(["-l", lang, "-r", &(((rate - 1.0) * 100.0).round() as i32).clamp(-100, 100).to_string(), "--"]);
    } else {
        command.args(["-v", lang, "-s", &((175.0 * rate).round() as i32).clamp(80, 400).to_string(), "--"]);
    }

    let child = command
        .arg(&clean)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("No se pudo iniciar {tool}: {error}"))?;

    let mut guard = state.speaking.lock().map_err(|_| "Estado de voz bloqueado.".to_string())?;
    *guard = Some(child);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn language_codes_are_validated() {
        assert!(valid_lang("es") && valid_lang("en") && valid_lang("pt-BR"));
        assert!(!valid_lang("") && !valid_lang("es; rm -rf /") && !valid_lang("EN") && !valid_lang("e") && !valid_lang("es_ES"));
    }

    #[test]
    fn transcript_is_cleaned() {
        assert_eq!(clean_transcript("[00:00:01.000 --> 00:00:02.000]  hola   mundo\n\n  adiós "), "hola mundo adiós");
        assert_eq!(clean_transcript("   \n  "), "");
    }

    #[test]
    fn speech_text_is_sanitized_and_capped() {
        assert_eq!(sanitize_speech("  hola\u{7}mundo  "), "hola mundo");
        assert_eq!(sanitize_speech(&"a".repeat(MAX_SPEAK_CHARS + 500)).len(), MAX_SPEAK_CHARS);
    }

    #[test]
    fn recorder_args_per_tool() {
        let wav = Path::new("/tmp/x.wav");
        assert_eq!(recorder_args("arecord", wav).last().unwrap(), "/tmp/x.wav");
        assert!(recorder_args("parecord", wav).iter().any(|a| a == "--file-format=wav"));
        assert!(recorder_args("pw-record", wav).iter().any(|a| a == "16000"));
    }

    // Binarios falsos en un PATH temporal: graba → transcribe → habla. Es el único test que toca PATH.
    #[test]
    fn full_flow_with_fake_tools() {
        use std::os::unix::fs::PermissionsExt;

        let dir = std::env::temp_dir().join(format!("aurelius-voice-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let write = |name: &str, body: &str| {
            let path = dir.join(name);
            fs::write(&path, body).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        };

        write("arecord", "#!/bin/bash\nf=\"${@: -1}\"\nhead -c 4096 /dev/urandom > \"$f\"\ntrap 'exit 0' INT TERM\nwhile true; do sleep 0.1; done\n");
        write("whisper-cli", "#!/bin/bash\nprintf '[00:00:00.000 --> 00:00:02.000]   hola   mundo\\n'\n");
        write("spd-say", &format!("#!/bin/bash\necho \"$@\" > {}/spd.txt\nexec sleep 30\n", dir.display()));
        fs::write(dir.join("model.bin"), "x").unwrap();

        std::env::set_var("PATH", format!("{}:/usr/bin:/bin", dir.display()));

        let tools = detect_tools();
        assert_eq!(tools.recorder.as_deref(), Some("arecord"));
        assert_eq!(tools.speaker.as_deref(), Some("spd-say"));
        assert_eq!(tools.transcriber.as_deref(), Some("whisper-cli"));

        let state = VoiceState::default();
        start_recording(&state).unwrap();
        assert!(start_recording(&state).is_err(), "no se permite grabar dos veces");
        std::thread::sleep(Duration::from_millis(250));
        let wav = stop_recording(&state).unwrap();
        assert!(stop_recording(&state).is_err());

        let model = dir.join("model.bin");
        assert!(transcribe(&wav, "es; x", model.to_str().unwrap()).is_err(), "idioma inválido");
        assert!(!wav.exists(), "el WAV se borra aunque falle");

        start_recording(&state).unwrap();
        std::thread::sleep(Duration::from_millis(250));
        let wav = stop_recording(&state).unwrap();
        assert!(transcribe(&wav, "es", "/no/existe.bin").is_err(), "modelo inexistente");

        start_recording(&state).unwrap();
        std::thread::sleep(Duration::from_millis(250));
        let wav = stop_recording(&state).unwrap();
        assert_eq!(transcribe(&wav, "es", model.to_str().unwrap()).unwrap(), "hola mundo");
        assert!(!wav.exists());

        speak(&state, "Hola -rf", "es", 1.5).unwrap();
        std::thread::sleep(Duration::from_millis(300));
        let args = fs::read_to_string(dir.join("spd.txt")).unwrap();
        assert!(args.contains("-l es") && args.contains("-r 50") && args.contains("-- Hola -rf"), "{args}");
        assert!(speak(&state, "x", "xx; ls", 1.0).is_err());
        stop_speaking(&state);

        let _ = fs::remove_dir_all(&dir);
    }
}
