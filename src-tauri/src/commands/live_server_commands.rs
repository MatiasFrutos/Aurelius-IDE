// src-tauri/src/commands/live_server_commands.rs
use serde::Serialize;
use std::{
    collections::VecDeque,
    fs,
    io::Read,
    net::TcpStream,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tiny_http::{Header, Request, Response, Server, StatusCode};

const DEFAULT_LIVE_SERVER_HOST: &str = "127.0.0.1";
const DEFAULT_LIVE_SERVER_PORT: u16 = 4587;

const MAX_INDEX_SEARCH_DEPTH: usize = 7;
const MAX_RELOAD_SCAN_DEPTH: usize = 14;
const MAX_RELOAD_SCAN_FILES: usize = 7000;

const LIVE_RELOAD_POLL_MS: u64 = 650;
const LIVE_RELOAD_SCAN_MS: u64 = 700;

#[derive(Debug, Clone, Serialize)]
pub struct LiveServerStatus {
    pub running: bool,
    pub host: String,
    pub port: u16,
    pub url: Option<String>,
    pub root: Option<String>,
    pub entry: Option<String>,
    pub reload_version: u64,
}

struct LiveServerRuntime {
    running: Arc<AtomicBool>,
    reload_version: Arc<AtomicU64>,
    server_handle: Option<JoinHandle<()>>,
    watcher_handle: Option<JoinHandle<()>>,
    root: PathBuf,
    entry: PathBuf,
    host: String,
    port: u16,
}

#[derive(Default)]
pub struct LiveServerManager {
    runtime: Mutex<Option<LiveServerRuntime>>,
}

#[tauri::command]
pub fn live_server_status(manager: tauri::State<LiveServerManager>) -> LiveServerStatus {
    let runtime = manager.runtime.lock().ok().and_then(|guard| {
        guard.as_ref().map(|runtime| {
            let running = runtime.running.load(Ordering::SeqCst);

            LiveServerStatus {
                running,
                host: runtime.host.clone(),
                port: runtime.port,
                url: if running {
                    Some(build_live_server_url(&runtime.host, runtime.port))
                } else {
                    None
                },
                root: if running {
                    Some(runtime.root.to_string_lossy().to_string())
                } else {
                    None
                },
                entry: if running {
                    Some(runtime.entry.to_string_lossy().to_string())
                } else {
                    None
                },
                reload_version: runtime.reload_version.load(Ordering::SeqCst),
            }
        })
    });

    runtime.unwrap_or_else(stopped_status)
}

#[tauri::command]
pub fn live_server_start(
    project_path: String,
    manager: tauri::State<LiveServerManager>,
) -> Result<LiveServerStatus, String> {
    let workspace_root = PathBuf::from(project_path);

    if !workspace_root.exists() {
        return Err("La carpeta del proyecto no existe.".to_string());
    }

    if !workspace_root.is_dir() {
        return Err("La ruta seleccionada no es una carpeta.".to_string());
    }

    let workspace_root = workspace_root
        .canonicalize()
        .map_err(|error| format!("No se pudo resolver la carpeta del proyecto: {error}"))?;

    let index_path = find_index_html(&workspace_root)?
        .canonicalize()
        .map_err(|error| {
            format!("Se encontró index.html, pero no se pudo resolver su ruta real: {error}")
        })?;

    if !index_path.starts_with(&workspace_root) {
        return Err("El index.html encontrado está fuera del proyecto.".to_string());
    }

    let server_root = choose_server_root(&workspace_root, &index_path)?;

    {
        let mut guard = manager
            .runtime
            .lock()
            .map_err(|_| "No se pudo bloquear el Live Server.".to_string())?;

        if let Some(runtime) = guard.as_ref() {
            if runtime.running.load(Ordering::SeqCst) {
                return Ok(LiveServerStatus {
                    running: true,
                    host: runtime.host.clone(),
                    port: runtime.port,
                    url: Some(build_live_server_url(&runtime.host, runtime.port)),
                    root: Some(runtime.root.to_string_lossy().to_string()),
                    entry: Some(runtime.entry.to_string_lossy().to_string()),
                    reload_version: runtime.reload_version.load(Ordering::SeqCst),
                });
            }
        }

        if let Some(runtime) = guard.take() {
            stop_runtime(runtime);
        }
    }

    let host = DEFAULT_LIVE_SERVER_HOST.to_string();
    let port = DEFAULT_LIVE_SERVER_PORT;
    let address = format!("{host}:{port}");

    let server = Server::http(&address)
        .map_err(|error| format!("No se pudo iniciar Live Server en {address}: {error}"))?;

    let running = Arc::new(AtomicBool::new(true));
    let reload_version = Arc::new(AtomicU64::new(1));

    let server_running = Arc::clone(&running);
    let server_reload_version = Arc::clone(&reload_version);
    let server_root_thread = server_root.clone();
    let server_entry_thread = index_path.clone();

    let server_handle = thread::spawn(move || {
        run_static_server(
            server,
            server_root_thread,
            server_entry_thread,
            server_running,
            server_reload_version,
        );
    });

    let watcher_running = Arc::clone(&running);
    let watcher_reload_version = Arc::clone(&reload_version);
    let watcher_root_thread = server_root.clone();

    let watcher_handle = thread::spawn(move || {
        run_reload_watcher(
            watcher_root_thread,
            watcher_running,
            watcher_reload_version,
        );
    });

    let runtime = LiveServerRuntime {
        running,
        reload_version: Arc::clone(&reload_version),
        server_handle: Some(server_handle),
        watcher_handle: Some(watcher_handle),
        root: server_root.clone(),
        entry: index_path.clone(),
        host: host.clone(),
        port,
    };

    let mut guard = manager
        .runtime
        .lock()
        .map_err(|_| "No se pudo guardar el estado del Live Server.".to_string())?;

    *guard = Some(runtime);

    Ok(LiveServerStatus {
        running: true,
        host: host.clone(),
        port,
        url: Some(build_live_server_url(&host, port)),
        root: Some(server_root.to_string_lossy().to_string()),
        entry: Some(index_path.to_string_lossy().to_string()),
        reload_version: reload_version.load(Ordering::SeqCst),
    })
}

#[tauri::command]
pub fn live_server_stop(
    manager: tauri::State<LiveServerManager>,
) -> Result<LiveServerStatus, String> {
    let mut guard = manager
        .runtime
        .lock()
        .map_err(|_| "No se pudo bloquear el Live Server.".to_string())?;

    let Some(runtime) = guard.take() else {
        return Ok(stopped_status());
    };

    let host = runtime.host.clone();
    let port = runtime.port;

    stop_runtime(runtime);

    Ok(LiveServerStatus {
        running: false,
        host,
        port,
        url: None,
        root: None,
        entry: None,
        reload_version: 0,
    })
}

#[tauri::command]
pub fn live_server_open_browser(
    manager: tauri::State<LiveServerManager>,
) -> Result<String, String> {
    let status = live_server_status(manager);

    if !status.running {
        return Err("Live Server no está iniciado.".to_string());
    }

    let Some(url) = status.url else {
        return Err("Live Server no tiene URL activa.".to_string());
    };

    open_url_linux(&url)?;

    Ok(url)
}

fn stopped_status() -> LiveServerStatus {
    LiveServerStatus {
        running: false,
        host: DEFAULT_LIVE_SERVER_HOST.to_string(),
        port: DEFAULT_LIVE_SERVER_PORT,
        url: None,
        root: None,
        entry: None,
        reload_version: 0,
    }
}

fn stop_runtime(mut runtime: LiveServerRuntime) {
    runtime.running.store(false, Ordering::SeqCst);
    wake_server(&runtime.host, runtime.port);

    if let Some(handle) = runtime.server_handle.take() {
        let _ = handle.join();
    }

    if let Some(handle) = runtime.watcher_handle.take() {
        let _ = handle.join();
    }
}

fn run_static_server(
    server: Server,
    root: PathBuf,
    entry: PathBuf,
    running: Arc<AtomicBool>,
    reload_version: Arc<AtomicU64>,
) {
    while running.load(Ordering::SeqCst) {
        match server.recv_timeout(Duration::from_millis(250)) {
            Ok(Some(request)) => {
                handle_request(request, &root, &entry, &reload_version);
            }
            Ok(None) => {}
            Err(_) => {}
        }
    }
}

fn run_reload_watcher(
    root: PathBuf,
    running: Arc<AtomicBool>,
    reload_version: Arc<AtomicU64>,
) {
    let mut previous_signature = scan_live_reload_signature(&root);

    while running.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(LIVE_RELOAD_SCAN_MS));

        if !running.load(Ordering::SeqCst) {
            break;
        }

        let next_signature = scan_live_reload_signature(&root);

        if next_signature != previous_signature {
            previous_signature = next_signature;
            reload_version.fetch_add(1, Ordering::SeqCst);
        }
    }
}

fn handle_request(
    request: Request,
    root: &Path,
    entry: &Path,
    reload_version: &Arc<AtomicU64>,
) {
    let method = request.method().as_str().to_uppercase();

    if method != "GET" && method != "HEAD" {
        let response = text_response(
            StatusCode(405),
            "Método no permitido.",
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    }

    let requested_path = request.url().split('?').next().unwrap_or("/");

    if requested_path == "/__aurelius/reload-version" {
        let response = text_response(
            StatusCode(200),
            &reload_version.load(Ordering::SeqCst).to_string(),
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    }

    if requested_path == "/__aurelius/client.js" {
        let response = text_response(
            StatusCode(200),
            &build_live_reload_client_script(),
            "text/javascript; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    }

    let relative_path = url_path_to_relative_path(requested_path);

    let mut file_path = if relative_path.as_os_str().is_empty() {
        entry.to_path_buf()
    } else {
        root.join(relative_path)
    };

    if file_path.is_dir() {
        file_path = file_path.join("index.html");
    }

    let Ok(root_canonical) = root.canonicalize() else {
        let response = text_response(
            StatusCode(500),
            "No se pudo resolver la carpeta raíz.",
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    };

    let Ok(file_canonical) = file_path.canonicalize() else {
        let response = text_response(
            StatusCode(404),
            "Archivo no encontrado.",
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    };

    if !file_canonical.starts_with(&root_canonical) {
        let response = text_response(
            StatusCode(403),
            "Acceso denegado.",
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    }

    let Ok(mut file) = fs::File::open(&file_canonical) else {
        let response = text_response(
            StatusCode(404),
            "Archivo no encontrado.",
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    };

    let mut bytes = Vec::new();

    if file.read_to_end(&mut bytes).is_err() {
        let response = text_response(
            StatusCode(500),
            "No se pudo leer el archivo.",
            "text/plain; charset=utf-8",
        );

        let _ = request.respond(response);
        return;
    }

    if is_html_file(&file_canonical) {
        bytes = inject_live_reload_client(bytes);
    }

    let content_type = get_content_type(&file_canonical);
    let response = bytes_response(StatusCode(200), bytes, content_type);

    let _ = request.respond(response);
}

fn find_index_html(root: &Path) -> Result<PathBuf, String> {
    let direct_index = root.join("index.html");

    if direct_index.is_file() {
        return Ok(direct_index);
    }

    let preferred_candidates = [
        root.join("src").join("index.html"),
        root.join("public").join("index.html"),
        root.join("frontend").join("index.html"),
        root.join("web").join("index.html"),
        root.join("app").join("index.html"),
        root.join("client").join("index.html"),
        root.join("frontend").join("public").join("index.html"),
        root.join("frontend").join("src").join("index.html"),
    ];

    for candidate in preferred_candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    let mut queue = VecDeque::new();
    queue.push_back((root.to_path_buf(), 0usize));

    while let Some((directory, depth)) = queue.pop_front() {
        if depth > MAX_INDEX_SEARCH_DEPTH {
            continue;
        }

        let Ok(entries) = fs::read_dir(&directory) else {
            continue;
        };

        let mut child_directories = Vec::new();
        let mut index_candidates = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if should_ignore_live_server_path(&file_name) {
                continue;
            }

            if path.is_file() && file_name.eq_ignore_ascii_case("index.html") {
                index_candidates.push(path);
                continue;
            }

            if path.is_dir() {
                child_directories.push(path);
            }
        }

        index_candidates.sort();

        if let Some(index) = index_candidates.into_iter().next() {
            return Ok(index);
        }

        child_directories.sort();

        for child_directory in child_directories {
            queue.push_back((child_directory, depth + 1));
        }
    }

    Err("No se encontró ningún index.html dentro del proyecto.".to_string())
}

fn choose_server_root(workspace_root: &Path, index_path: &Path) -> Result<PathBuf, String> {
    let index_parent = index_path
        .parent()
        .ok_or_else(|| "No se pudo detectar la carpeta del index.html.".to_string())?
        .to_path_buf()
        .canonicalize()
        .map_err(|error| format!("No se pudo resolver la carpeta del index.html: {error}"))?;

    if !index_parent.starts_with(workspace_root) {
        return Err("La carpeta del index.html está fuera del proyecto.".to_string());
    }

    let html = fs::read_to_string(index_path).unwrap_or_default();
    let references = extract_html_asset_references(&html);

    let mut candidates = Vec::new();

    candidates.push(index_parent.clone());
    candidates.push(workspace_root.to_path_buf());

    let common_candidates = [
        workspace_root.join("frontend"),
        workspace_root.join("public"),
        workspace_root.join("src"),
        workspace_root.join("web"),
        workspace_root.join("app"),
        workspace_root.join("client"),
    ];

    for candidate in common_candidates {
        if candidate.is_dir() {
            candidates.push(candidate);
        }
    }

    let mut current = index_parent.clone();

    while let Some(parent) = current.parent() {
        if !parent.starts_with(workspace_root) {
            break;
        }

        candidates.push(parent.to_path_buf());

        if parent == workspace_root {
            break;
        }

        current = parent.to_path_buf();
    }

    candidates.sort();
    candidates.dedup();

    let mut best_root = index_parent.clone();
    let mut best_score = score_server_root(&best_root, index_path, &references);

    for candidate in candidates {
        let Ok(candidate) = candidate.canonicalize() else {
            continue;
        };

        if !candidate.starts_with(workspace_root) {
            continue;
        }

        if !index_path.starts_with(&candidate) {
            continue;
        }

        let score = score_server_root(&candidate, index_path, &references);

        if score > best_score {
            best_score = score;
            best_root = candidate;
        }
    }

    Ok(best_root)
}

fn score_server_root(root: &Path, index_path: &Path, references: &[String]) -> i32 {
    let mut score = 0;

    if root.join("index.html").is_file() {
        score += 20;
    }

    if index_path.starts_with(root) {
        score += 10;
    }

    for important_directory in [
        "src",
        "assets",
        "js",
        "css",
        "scripts",
        "styles",
        "pages",
        "partials",
    ] {
        if root.join(important_directory).is_dir() {
            score += 5;
        }
    }

    for reference in references {
        let normalized_reference = normalize_asset_reference(reference);

        if normalized_reference.as_os_str().is_empty() {
            continue;
        }

        let candidate = root.join(&normalized_reference);

        if candidate.exists() {
            score += 12;
            continue;
        }

        let normalized_reference_text = normalized_reference.to_string_lossy();

        if normalized_reference_text.starts_with("src/") && root.join("src").is_dir() {
            score += 4;
        }

        if normalized_reference_text.starts_with("assets/") && root.join("assets").is_dir() {
            score += 4;
        }

        if normalized_reference_text.starts_with("js/") && root.join("js").is_dir() {
            score += 4;
        }

        if normalized_reference_text.starts_with("css/") && root.join("css").is_dir() {
            score += 4;
        }
    }

    score
}

fn extract_html_asset_references(html: &str) -> Vec<String> {
    let mut references = Vec::new();

    for attribute in ["src=\"", "src='", "href=\"", "href='"] {
        let quote = if attribute.ends_with('"') { '"' } else { '\'' };
        let mut rest = html;

        while let Some(position) = rest.find(attribute) {
            let after_attribute = &rest[position + attribute.len()..];

            let Some(end_position) = after_attribute.find(quote) else {
                break;
            };

            let value = after_attribute[..end_position].trim();

            if is_local_asset_reference(value) {
                references.push(value.to_string());
            }

            rest = &after_attribute[end_position + 1..];
        }
    }

    references.sort();
    references.dedup();
    references
}

fn is_local_asset_reference(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }

    let lower = value.to_lowercase();

    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("//")
        || lower.starts_with("data:")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || lower.starts_with("#")
    {
        return false;
    }

    true
}

fn normalize_asset_reference(reference: &str) -> PathBuf {
    let clean = reference
        .split('?')
        .next()
        .unwrap_or("")
        .split('#')
        .next()
        .unwrap_or("")
        .trim()
        .trim_start_matches('/')
        .to_string();

    let clean = clean
        .split('/')
        .filter(|part| !part.is_empty())
        .filter(|part| *part != "." && *part != "..")
        .map(percent_decode)
        .collect::<Vec<_>>();

    let mut path = PathBuf::new();

    for part in clean {
        path.push(part);
    }

    path
}

fn should_ignore_live_server_path(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".idea"
            | ".vscode"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".cache"
            | ".tauri"
            | ".turbo"
            | "vendor"
            | "coverage"
            | ".parcel-cache"
    )
}

fn build_live_server_url(host: &str, port: u16) -> String {
    format!("http://{host}:{port}")
}

fn url_path_to_relative_path(url_path: &str) -> PathBuf {
    let clean = url_path
        .trim_start_matches('/')
        .split('/')
        .filter(|part| !part.is_empty())
        .filter(|part| *part != "." && *part != "..")
        .map(percent_decode)
        .collect::<Vec<_>>();

    let mut path = PathBuf::new();

    for part in clean {
        path.push(part);
    }

    path
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = &value[index + 1..index + 3];

            if let Ok(decoded) = u8::from_str_radix(hex, 16) {
                output.push(decoded);
                index += 3;
                continue;
            }
        }

        if bytes[index] == b'+' {
            output.push(b' ');
        } else {
            output.push(bytes[index]);
        }

        index += 1;
    }

    String::from_utf8_lossy(&output).to_string()
}

fn is_html_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "html" | "htm"
    )
}

fn inject_live_reload_client(bytes: Vec<u8>) -> Vec<u8> {
    let Ok(mut html) = String::from_utf8(bytes.clone()) else {
        return bytes;
    };

    if html.contains("__aurelius_live_reload__") {
        return html.into_bytes();
    }

    let script = format!(
        r#"
<script id="__aurelius_live_reload__">
{}
</script>
"#,
        build_live_reload_client_script()
    );

    let lower_html = html.to_lowercase();

    if let Some(index) = lower_html.rfind("</body>") {
        html.insert_str(index, &script);
        return html.into_bytes();
    }

    if let Some(index) = lower_html.rfind("</html>") {
        html.insert_str(index, &script);
        return html.into_bytes();
    }

    html.push_str(&script);
    html.into_bytes()
}

fn build_live_reload_client_script() -> String {
    format!(
        r#"(function () {{
  "use strict";

  var pollMs = {poll_ms};
  var endpoint = "/__aurelius/reload-version";
  var currentVersion = null;
  var reloading = false;

  function schedule() {{
    window.setTimeout(check, pollMs);
  }}

  function check() {{
    if (reloading) {{
      return;
    }}

    window
      .fetch(endpoint + "?t=" + Date.now(), {{
        cache: "no-store"
      }})
      .then(function (response) {{
        if (!response.ok) {{
          throw new Error("Live reload endpoint failed");
        }}

        return response.text();
      }})
      .then(function (version) {{
        version = String(version || "").trim();

        if (!version) {{
          schedule();
          return;
        }}

        if (currentVersion === null) {{
          currentVersion = version;
          schedule();
          return;
        }}

        if (version !== currentVersion) {{
          reloading = true;
          window.location.reload();
          return;
        }}

        schedule();
      }})
      .catch(function () {{
        schedule();
      }});
  }}

  schedule();
}})();"#,
        poll_ms = LIVE_RELOAD_POLL_MS
    )
}

fn scan_live_reload_signature(root: &Path) -> u64 {
    let mut count = 0usize;
    let mut signature = 0u64;

    scan_live_reload_signature_inner(root, 0, &mut count, &mut signature);

    signature ^ ((count as u64) << 32)
}

fn scan_live_reload_signature_inner(
    directory: &Path,
    depth: usize,
    count: &mut usize,
    signature: &mut u64,
) {
    if depth > MAX_RELOAD_SCAN_DEPTH || *count >= MAX_RELOAD_SCAN_FILES {
        return;
    }

    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    for entry in entries.flatten() {
        if *count >= MAX_RELOAD_SCAN_FILES {
            return;
        }

        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            if should_ignore_live_server_path(&file_name) {
                continue;
            }

            scan_live_reload_signature_inner(&path, depth + 1, count, signature);
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        if !is_live_reload_relevant_file(&path) {
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        *count += 1;

        let modified = metadata
            .modified()
            .ok()
            .and_then(system_time_to_millis)
            .unwrap_or(0);

        let size = metadata.len();
        let path_hash = hash_path(&path);

        *signature = signature
            .wrapping_add(modified.rotate_left(7))
            .wrapping_add(size.rotate_left(17))
            .wrapping_add(path_hash);
    }
}

fn is_live_reload_relevant_file(path: &Path) -> bool {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_lowercase();

    if extension.is_empty() {
        return true;
    }

    matches!(
        extension.as_str(),
        "html"
            | "htm"
            | "css"
            | "js"
            | "mjs"
            | "cjs"
            | "jsx"
            | "ts"
            | "tsx"
            | "json"
            | "svg"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "ico"
            | "wasm"
            | "txt"
            | "md"
            | "map"
            | "xml"
    )
}

fn hash_path(path: &Path) -> u64 {
    let text = path.to_string_lossy().replace('\\', "/");
    let mut hash = 1469598103934665603u64;

    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(1099511628211);
    }

    hash
}

fn system_time_to_millis(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn get_content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "wasm" => "application/wasm",
        "txt" => "text/plain; charset=utf-8",
        "map" => "application/json; charset=utf-8",
        "xml" => "application/xml; charset=utf-8",
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        _ => "application/octet-stream",
    }
}

fn text_response(
    status: StatusCode,
    text: &str,
    content_type: &'static str,
) -> Response<std::io::Cursor<Vec<u8>>> {
    bytes_response(status, text.as_bytes().to_vec(), content_type)
}

fn bytes_response(
    status: StatusCode,
    bytes: Vec<u8>,
    content_type: &'static str,
) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut response = Response::from_data(bytes).with_status_code(status);

    if let Ok(header) = Header::from_bytes("Content-Type", content_type) {
        response.add_header(header);
    }

    if let Ok(header) = Header::from_bytes("Cache-Control", "no-store") {
        response.add_header(header);
    }

    response
}

fn wake_server(host: &str, port: u16) {
    let _ = TcpStream::connect(format!("{host}:{port}"));
}

fn open_url_linux(url: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map_err(|error| format!("No se pudo abrir el navegador: {error}"))?;

    Ok(())
}