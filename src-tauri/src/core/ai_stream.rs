// src-tauri/src/core/ai_stream.rs
// Respuestas de IA en streaming (SSE / NDJSON) para Ollama, OpenAI, OpenRouter y Claude.
use super::fs::{
    api_error_message, claude_messages_url, describe_status, normalize_ai_provider,
    normalize_base_url, openai_like_base_url, sanitize_claude_messages, AiChatRequest,
};
use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AiStreamEvent {
    pub id: String,
    /// "delta" | "done" | "error"
    pub kind: String,
    pub text: String,
}

impl AiStreamEvent {
    fn new(id: &str, kind: &str, text: impl Into<String>) -> Self {
        Self {
            id: id.to_string(),
            kind: kind.to_string(),
            text: text.into(),
        }
    }
}

/// Resultado de interpretar una línea del flujo.
#[derive(Debug, PartialEq)]
pub enum Piece {
    Delta(String),
    Done,
    Error(String),
    Skip,
}

fn streaming_client() -> Result<Client, String> {
    // Sin timeout total (la respuesta puede tardar); solo conexión y silencio entre chunks.
    Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(120))
        .build()
        .map_err(|error| format!("No se pudo crear el cliente HTTP. Detalle: {}", error))
}

pub fn parse_openai_line(line: &str) -> Piece {
    let line = line.trim();

    // Comentarios SSE (OpenRouter manda ": OPENROUTER PROCESSING")
    if line.is_empty() || line.starts_with(':') {
        return Piece::Skip;
    }

    let Some(data) = line.strip_prefix("data:") else {
        return Piece::Skip;
    };

    let data = data.trim();

    if data == "[DONE]" {
        return Piece::Done;
    }

    let Ok(value) = serde_json::from_str::<Value>(data) else {
        return Piece::Skip;
    };

    if value.get("error").is_some() {
        return Piece::Error(api_error_message(&value));
    }

    let delta = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(Value::as_str)
        .unwrap_or("");

    if delta.is_empty() {
        Piece::Skip
    } else {
        Piece::Delta(delta.to_string())
    }
}

pub fn parse_claude_line(line: &str) -> Piece {
    let line = line.trim();

    let Some(data) = line.strip_prefix("data:") else {
        return Piece::Skip;
    };

    let Ok(value) = serde_json::from_str::<Value>(data.trim()) else {
        return Piece::Skip;
    };

    match value.get("type").and_then(Value::as_str) {
        Some("content_block_delta") => value
            .get("delta")
            .and_then(|delta| delta.get("text"))
            .and_then(Value::as_str)
            .map(|text| Piece::Delta(text.to_string()))
            .unwrap_or(Piece::Skip),
        Some("message_stop") => Piece::Done,
        Some("error") => Piece::Error(api_error_message(&value)),
        _ => Piece::Skip,
    }
}

pub fn parse_ollama_line(line: &str) -> Piece {
    let line = line.trim();

    if line.is_empty() {
        return Piece::Skip;
    }

    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return Piece::Skip;
    };

    if let Some(error) = value.get("error").and_then(Value::as_str) {
        return Piece::Error(error.to_string());
    }

    if value.get("done").and_then(Value::as_bool) == Some(true) {
        return Piece::Done;
    }

    let text = value
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .unwrap_or("");

    if text.is_empty() {
        Piece::Skip
    } else {
        Piece::Delta(text.to_string())
    }
}

/// Transmite la respuesta del proveedor llamando a `on_event` por cada fragmento.
/// Siempre termina emitiendo "done" o "error".
pub async fn stream_chat<F>(stream_id: &str, request: AiChatRequest, mut on_event: F)
where
    F: FnMut(AiStreamEvent),
{
    let result = run_stream(stream_id, request, &mut on_event).await;

    match result {
        Ok(()) => on_event(AiStreamEvent::new(stream_id, "done", "")),
        Err(message) => on_event(AiStreamEvent::new(stream_id, "error", message)),
    }
}

async fn run_stream<F>(stream_id: &str, request: AiChatRequest, on_event: &mut F) -> Result<(), String>
where
    F: FnMut(AiStreamEvent),
{
    let provider = normalize_ai_provider(&request.provider);
    let model = request.model.trim().to_string();

    if model.is_empty() {
        return Err("Tenés que configurar un modelo de IA.".to_string());
    }

    let client = streaming_client()?;

    let builder = match provider.as_str() {
        "ollama" => {
            let base = normalize_base_url(&request.base_url, "http://localhost:11434");
            let mut body = json!({ "model": model, "messages": request.messages, "stream": true });

            if request.temperature.is_some() || request.max_tokens.is_some() {
                body["options"] = json!({});
                if let Some(temperature) = request.temperature {
                    body["options"]["temperature"] = json!(temperature);
                }
                if let Some(max_tokens) = request.max_tokens {
                    body["options"]["num_predict"] = json!(max_tokens);
                }
            }

            client.post(format!("{}/api/chat", base)).json(&body)
        }
        "openai" | "openrouter" => {
            let api_key = request.api_key.trim();

            if api_key.is_empty() {
                return Err("Tenés que configurar una API Key para este proveedor.".to_string());
            }

            let base = openai_like_base_url(&request.base_url, &provider);
            let mut body = json!({ "model": model, "messages": request.messages, "stream": true });

            if let Some(temperature) = request.temperature {
                body["temperature"] = json!(temperature);
            }
            if let Some(max_tokens) = request.max_tokens {
                body["max_tokens"] = json!(max_tokens);
            }

            let mut builder = client
                .post(format!("{}/chat/completions", base))
                .bearer_auth(api_key)
                .json(&body);

            if provider == "openrouter" {
                builder = builder
                    .header("HTTP-Referer", "https://github.com/MatiasFrutos/Aurelius-IDE")
                    .header("X-Title", "Aurelius IDE");
            }

            builder
        }
        "claude" => {
            let api_key = request.api_key.trim();

            if api_key.is_empty() {
                return Err("Tenés que configurar una API Key de Claude.".to_string());
            }

            let mut system_prompt = String::from("Sos un asistente técnico integrado dentro de Aurelius IDE.");
            let mut messages = Vec::new();

            for message in &request.messages {
                if message.role == "system" {
                    system_prompt = message.content.clone();
                    continue;
                }

                let role = if message.role == "assistant" { "assistant" } else { "user" };
                messages.push(json!({ "role": role, "content": message.content }));
            }

            let messages = sanitize_claude_messages(messages);

            if messages.is_empty() {
                return Err("No hay ningún mensaje de usuario para enviar a Claude.".to_string());
            }

            let mut body = json!({
                "model": model,
                "max_tokens": request.max_tokens.unwrap_or(4096),
                "system": system_prompt,
                "messages": messages,
                "stream": true
            });

            if let Some(temperature) = request.temperature {
                body["temperature"] = json!(temperature.clamp(0.0, 1.0));
            }

            client
                .post(claude_messages_url(&request.base_url))
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
        }
        _ => return Err("Proveedor de IA no soportado.".to_string()),
    };

    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            "El proveedor IA tardó demasiado en responder (timeout).".to_string()
        } else {
            format!("No se pudo conectar con el proveedor IA. Detalle: {}", error)
        }
    })?;

    let status = response.status();

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        let detail = serde_json::from_str::<Value>(&text)
            .map(|value| api_error_message(&value))
            .unwrap_or_else(|_| text.chars().take(300).collect());

        return Err(format!(
            "El proveedor IA devolvió HTTP {} ({}): {}",
            status.as_u16(),
            describe_status(status),
            detail
        ));
    }

    let parse: fn(&str) -> Piece = match provider.as_str() {
        "ollama" => parse_ollama_line,
        "claude" => parse_claude_line,
        _ => parse_openai_line,
    };

    let mut buffer: Vec<u8> = Vec::new();
    let mut emitted_any = false;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("Se cortó la conexión con el proveedor IA. Detalle: {}", error))?;
        buffer.extend_from_slice(&chunk);

        // Procesamos solo líneas completas (el chunk puede cortar una línea o un carácter UTF-8 a la mitad).
        while let Some(position) = buffer.iter().position(|byte| *byte == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=position).collect();
            let line = String::from_utf8_lossy(&line_bytes);

            match parse(&line) {
                Piece::Delta(text) => {
                    emitted_any = true;
                    on_event(AiStreamEvent::new(stream_id, "delta", text));
                }
                Piece::Done => return Ok(()),
                Piece::Error(message) => return Err(format!("El proveedor IA devolvió un error: {}", message)),
                Piece::Skip => {}
            }
        }
    }

    // Última línea sin salto final
    if !buffer.is_empty() {
        let line = String::from_utf8_lossy(&buffer).to_string();

        match parse(&line) {
            Piece::Delta(text) => {
                emitted_any = true;
                on_event(AiStreamEvent::new(stream_id, "delta", text));
            }
            Piece::Error(message) => return Err(format!("El proveedor IA devolvió un error: {}", message)),
            _ => {}
        }
    }

    if emitted_any {
        Ok(())
    } else {
        Err("El proveedor IA no devolvió contenido.".to_string())
    }
}
