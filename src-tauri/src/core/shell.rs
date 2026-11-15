// src-tauri/src/core/shell.rs
// Ejecución acotada de Git y sondeo de herramientas, más detalles del sistema (procesos, discos, red).
// Todo con listas blancas: el frontend nunca puede ejecutar comandos arbitrarios por esta vía.
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const MAX_OUTPUT_BYTES: usize = 2 * 1024 * 1024;
const GIT_TIMEOUT: Duration = Duration::from_secs(60);

const ALLOWED_GIT: &[&str] = &[
    "status", "diff", "log", "show", "branch", "checkout", "switch", "add", "restore", "reset",
    "commit", "stash", "fetch", "pull", "push", "blame", "rev-parse", "remote", "tag", "ls-files",
    "init", "config", "clean",
];

#[derive(Debug, Clone, Serialize)]
pub struct CommandOutput {
    pub ok: bool,
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
    pub truncated: bool,
    pub timed_out: bool,
}

fn read_limited<R: Read>(mut reader: R) -> (Vec<u8>, bool) {
    let mut data = Vec::new();
    let mut buffer = [0_u8; 8192];
    let mut truncated = false;

    loop {
        match reader.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(size) => {
                if data.len() + size > MAX_OUTPUT_BYTES {
                    let room = MAX_OUTPUT_BYTES.saturating_sub(data.len());
                    data.extend_from_slice(&buffer[..room]);
                    truncated = true;
                    // seguimos drenando para no bloquear al proceso hijo
                } else {
                    data.extend_from_slice(&buffer[..size]);
                }
            }
        }
    }

    (data, truncated)
}

pub(crate) fn run_with_timeout(mut command: Command, timeout: Duration) -> Result<CommandOutput, String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("No se pudo ejecutar el comando: {error}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let out_handle = thread::spawn(move || stdout.map(read_limited).unwrap_or_default());
    let err_handle = thread::spawn(move || stderr.map(read_limited).unwrap_or_default());

    let started = Instant::now();
    let mut timed_out = false;

    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => {
                if started.elapsed() > timeout {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break None;
                }
                thread::sleep(Duration::from_millis(15));
            }
            Err(error) => return Err(format!("Error esperando al proceso: {error}")),
        }
    };

    let (out, out_truncated) = out_handle.join().unwrap_or_default();
    let (err, err_truncated) = err_handle.join().unwrap_or_default();

    Ok(CommandOutput {
        ok: status.map(|s| s.success()).unwrap_or(false),
        code: status.and_then(|s| s.code()).unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out).to_string(),
        stderr: String::from_utf8_lossy(&err).to_string(),
        truncated: out_truncated || err_truncated,
        timed_out,
    })
}

/// Ejecuta `git <args>` dentro de `project_path`. Solo subcomandos de la lista blanca.
pub fn run_git(project_path: &str, args: &[String]) -> Result<CommandOutput, String> {
    let root = Path::new(project_path);

    if !root.is_dir() {
        return Err("La ruta del proyecto no es una carpeta.".to_string());
    }

    let Some(subcommand) = args.first() else {
        return Err("Falta el subcomando de Git.".to_string());
    };

    if !ALLOWED_GIT.contains(&subcommand.as_str()) {
        return Err(format!("El subcomando de Git '{subcommand}' no está permitido."));
    }

    // Impide inyectar ejecución de programas por opciones (p. ej. --upload-pack, --exec, -c core.sshCommand=…)
    for arg in args {
        let lower = arg.to_lowercase();
        if lower.starts_with("--upload-pack")
            || lower.starts_with("--receive-pack")
            || lower.starts_with("--exec")
            || lower.starts_with("--ext-diff")
            || lower.starts_with("--textconv")
            || lower == "-c"
        {
            return Err(format!("La opción '{arg}' no está permitida."));
        }
    }

    // `git config` solo para lectura
    if subcommand == "config" && !args.iter().any(|a| a == "--get" || a == "--get-all" || a == "--list" || a == "-l") {
        return Err("Solo se permite leer la configuración de Git.".to_string());
    }

    let mut command = Command::new("git");
    command
        .current_dir(root)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("LC_ALL", "C.UTF-8")
        .env("LANG", "C.UTF-8");

    run_with_timeout(command, GIT_TIMEOUT)
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolProbe {
    pub name: String,
    pub found: bool,
    pub version: String,
}

fn probe_args(name: &str) -> Option<(&'static str, Vec<&'static str>)> {
    match name {
        "node" => Some(("node", vec!["--version"])),
        "npm" => Some(("npm", vec!["--version"])),
        "pnpm" => Some(("pnpm", vec!["--version"])),
        "yarn" => Some(("yarn", vec!["--version"])),
        "bun" => Some(("bun", vec!["--version"])),
        "deno" => Some(("deno", vec!["--version"])),
        "python3" => Some(("python3", vec!["--version"])),
        "pip3" => Some(("pip3", vec!["--version"])),
        "go" => Some(("go", vec!["version"])),
        "java" => Some(("java", vec!["-version"])),
        "gcc" => Some(("gcc", vec!["--version"])),
        "make" => Some(("make", vec!["--version"])),
        "cmake" => Some(("cmake", vec!["--version"])),
        "docker" => Some(("docker", vec!["--version"])),
        "docker-compose" => Some(("docker", vec!["compose", "version"])),
        "kubectl" => Some(("kubectl", vec!["version", "--client"])),
        "psql" => Some(("psql", vec!["--version"])),
        "sqlite3" => Some(("sqlite3", vec!["--version"])),
        "ollama" => Some(("ollama", vec!["--version"])),
        "git" => Some(("git", vec!["--version"])),
        "cargo" => Some(("cargo", vec!["--version"])),
        "rustc" => Some(("rustc", vec!["--version"])),
        "php" => Some(("php", vec!["--version"])),
        "ruby" => Some(("ruby", vec!["--version"])),
        "dotnet" => Some(("dotnet", vec!["--version"])),
        "gh" => Some(("gh", vec!["--version"])),
        _ => None,
    }
}

pub fn probe_tools(names: &[String]) -> Vec<ToolProbe> {
    names
        .iter()
        .map(|name| {
            let Some((program, args)) = probe_args(name) else {
                return ToolProbe { name: name.clone(), found: false, version: "no soportado".to_string() };
            };

            let mut command = Command::new(program);
            command.args(args).env("LC_ALL", "C");

            match run_with_timeout(command, Duration::from_secs(5)) {
                Ok(output) if output.ok || !output.stdout.trim().is_empty() || !output.stderr.trim().is_empty() => {
                    // `java -version` escribe en stderr
                    let text = if output.stdout.trim().is_empty() { output.stderr } else { output.stdout };
                    let first = text.lines().next().unwrap_or("").trim().to_string();
                    ToolProbe { name: name.clone(), found: output.ok, version: first }
                }
                _ => ToolProbe { name: name.clone(), found: false, version: String::new() },
            }
        })
        .collect()
}

/* ------------------------------------------------------------------ */
/* Detalles del sistema                                                */
/* ------------------------------------------------------------------ */

#[derive(Debug, Clone, Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub filesystem: String,
    pub mount: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct NetworkInfo {
    pub interface: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemDetails {
    pub processes: Vec<ProcessInfo>,
    pub disks: Vec<DiskInfo>,
    pub network: Vec<NetworkInfo>,
    pub uptime_seconds: u64,
    pub battery_percent: Option<u8>,
    pub battery_status: Option<String>,
    pub hostname: String,
    pub kernel: String,
}

pub fn parse_ps(text: &str) -> Vec<ProcessInfo> {
    text.lines()
        .skip(1)
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let pid = parts.next()?.parse().ok()?;
            let cpu = parts.next()?.parse().ok()?;
            let mem = parts.next()?.parse().ok()?;
            let rss_kb: u64 = parts.next()?.parse().ok()?;
            let name = parts.collect::<Vec<_>>().join(" ");

            Some(ProcessInfo {
                pid,
                name,
                cpu_percent: cpu,
                memory_percent: mem,
                memory_bytes: rss_kb * 1024,
            })
        })
        .collect()
}

pub fn parse_df(text: &str) -> Vec<DiskInfo> {
    let mut seen = std::collections::HashSet::new();

    text.lines()
        .skip(1)
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();

            if parts.len() < 6 {
                return None;
            }

            let total: u64 = parts[1].parse().ok()?;
            let used: u64 = parts[2].parse().ok()?;
            let mount = parts[5..].join(" ");

            if total == 0 || !parts[0].starts_with('/') || !seen.insert(parts[0].to_string()) {
                return None;
            }

            Some(DiskInfo {
                filesystem: parts[0].to_string(),
                mount,
                total_bytes: total,
                used_bytes: used,
            })
        })
        .collect()
}

pub fn parse_net_dev(text: &str) -> Vec<NetworkInfo> {
    text.lines()
        .skip(2)
        .filter_map(|line| {
            let (name, rest) = line.split_once(':')?;
            let name = name.trim();

            if name == "lo" {
                return None;
            }

            let fields: Vec<u64> = rest.split_whitespace().filter_map(|v| v.parse().ok()).collect();

            if fields.len() < 9 {
                return None;
            }

            Some(NetworkInfo {
                interface: name.to_string(),
                rx_bytes: fields[0],
                tx_bytes: fields[8],
            })
        })
        .collect()
}

pub fn read_system_details() -> Result<SystemDetails, String> {
    let mut ps = Command::new("ps");
    ps.args(["-eo", "pid,pcpu,pmem,rss,comm", "--sort=-pcpu"]).env("LC_ALL", "C");
    let processes = run_with_timeout(ps, Duration::from_secs(5))
        .map(|output| parse_ps(&output.stdout).into_iter().take(12).collect())
        .unwrap_or_default();

    let mut df = Command::new("df");
    df.args(["-P", "-B1"]).env("LC_ALL", "C");
    let disks = run_with_timeout(df, Duration::from_secs(5))
        .map(|output| parse_df(&output.stdout))
        .unwrap_or_default();

    let network = fs::read_to_string("/proc/net/dev")
        .map(|text| parse_net_dev(&text))
        .unwrap_or_default();

    let uptime_seconds = fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|text| text.split_whitespace().next().and_then(|v| v.parse::<f64>().ok()))
        .map(|v| v as u64)
        .unwrap_or(0);

    let (battery_percent, battery_status) = read_battery();

    let hostname = fs::read_to_string("/etc/hostname")
        .map(|v| v.trim().to_string())
        .unwrap_or_default();

    let kernel = fs::read_to_string("/proc/sys/kernel/osrelease")
        .map(|v| v.trim().to_string())
        .unwrap_or_default();

    Ok(SystemDetails {
        processes,
        disks,
        network,
        uptime_seconds,
        battery_percent,
        battery_status,
        hostname,
        kernel,
    })
}

fn read_battery() -> (Option<u8>, Option<String>) {
    let Ok(entries) = fs::read_dir("/sys/class/power_supply") else {
        return (None, None);
    };

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        if !name.starts_with("BAT") {
            continue;
        }

        let base = entry.path();
        let percent = fs::read_to_string(base.join("capacity"))
            .ok()
            .and_then(|v| v.trim().parse::<u8>().ok());
        let status = fs::read_to_string(base.join("status")).ok().map(|v| v.trim().to_string());

        return (percent, status);
    }

    (None, None)
}
