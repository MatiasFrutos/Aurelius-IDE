// src-tauri/src/core/system.rs
use serde::Serialize;
use std::fs;
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, Serialize)]
pub struct ProcessMonitorSnapshot {
    pub pid: u32,
    pub cpu_percent: f64,
    pub memory_bytes: u64,
    pub virtual_memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemMonitorSnapshot {
    pub total_memory_bytes: u64,
    pub used_memory_bytes: u64,
    pub free_memory_bytes: u64,
    pub cpu_count: usize,
    pub load_average: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonitorSnapshot {
    pub process: ProcessMonitorSnapshot,
    pub system: SystemMonitorSnapshot,
    pub last_updated_at: String,
}

#[derive(Debug, Clone)]
struct CpuSample {
    process_ticks: u64,
    system_ticks: u64,
}

static CPU_SAMPLE: OnceLock<Mutex<Option<CpuSample>>> = OnceLock::new();

pub fn get_monitor_snapshot() -> Result<MonitorSnapshot, String> {
    let pid = std::process::id();

    let process_memory = read_process_memory()?;
    let cpu_percent = calculate_process_cpu_percent().unwrap_or(0.0);
    let system_memory = read_system_memory()?;
    let cpu_count = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(1);

    Ok(MonitorSnapshot {
        process: ProcessMonitorSnapshot {
            pid,
            cpu_percent,
            memory_bytes: process_memory.resident_bytes,
            virtual_memory_bytes: process_memory.virtual_bytes,
        },
        system: SystemMonitorSnapshot {
            total_memory_bytes: system_memory.total_bytes,
            used_memory_bytes: system_memory.used_bytes,
            free_memory_bytes: system_memory.free_bytes,
            cpu_count,
            load_average: read_load_average(),
        },
        last_updated_at: now_label(),
    })
}

#[derive(Debug, Clone)]
struct ProcessMemory {
    resident_bytes: u64,
    virtual_bytes: u64,
}

#[derive(Debug, Clone)]
struct SystemMemory {
    total_bytes: u64,
    used_bytes: u64,
    free_bytes: u64,
}

fn read_process_memory() -> Result<ProcessMemory, String> {
    let status = fs::read_to_string("/proc/self/status")
        .map_err(|error| format!("No se pudo leer /proc/self/status. Detalle: {}", error))?;

    let mut resident_kb = 0_u64;
    let mut virtual_kb = 0_u64;

    for line in status.lines() {
        if line.starts_with("VmRSS:") {
            resident_kb = parse_status_kb(line);
        }

        if line.starts_with("VmSize:") {
            virtual_kb = parse_status_kb(line);
        }
    }

    Ok(ProcessMemory {
        resident_bytes: resident_kb.saturating_mul(1024),
        virtual_bytes: virtual_kb.saturating_mul(1024),
    })
}

fn read_system_memory() -> Result<SystemMemory, String> {
    let meminfo = fs::read_to_string("/proc/meminfo")
        .map_err(|error| format!("No se pudo leer /proc/meminfo. Detalle: {}", error))?;

    let mut total_kb = 0_u64;
    let mut available_kb = 0_u64;
    let mut free_kb = 0_u64;

    for line in meminfo.lines() {
        if line.starts_with("MemTotal:") {
            total_kb = parse_status_kb(line);
        }

        if line.starts_with("MemAvailable:") {
            available_kb = parse_status_kb(line);
        }

        if line.starts_with("MemFree:") {
            free_kb = parse_status_kb(line);
        }
    }

    let safe_available_kb = if available_kb > 0 { available_kb } else { free_kb };
    let used_kb = total_kb.saturating_sub(safe_available_kb);

    Ok(SystemMemory {
        total_bytes: total_kb.saturating_mul(1024),
        used_bytes: used_kb.saturating_mul(1024),
        free_bytes: safe_available_kb.saturating_mul(1024),
    })
}

fn parse_status_kb(line: &str) -> u64 {
    line.split_whitespace()
        .find_map(|part| part.parse::<u64>().ok())
        .unwrap_or(0)
}

fn read_load_average() -> String {
    fs::read_to_string("/proc/loadavg")
        .ok()
        .and_then(|content| {
            let values = content
                .split_whitespace()
                .take(3)
                .collect::<Vec<_>>()
                .join(" ");

            if values.trim().is_empty() {
                None
            } else {
                Some(values)
            }
        })
        .unwrap_or_else(|| "No disponible".to_string())
}

fn calculate_process_cpu_percent() -> Result<f64, String> {
    let process_ticks = read_process_cpu_ticks()?;
    let system_ticks = read_system_cpu_ticks()?;
    let cpu_count = std::thread::available_parallelism()
        .map(|value| value.get() as f64)
        .unwrap_or(1.0);

    let storage = CPU_SAMPLE.get_or_init(|| Mutex::new(None));
    let mut previous = storage
        .lock()
        .map_err(|_| "No se pudo bloquear el estado del monitor CPU.".to_string())?;

    let current = CpuSample {
      process_ticks,
      system_ticks,
    };

    let Some(previous_sample) = previous.clone() else {
        *previous = Some(current);
        return Ok(0.0);
    };

    let process_delta = current.process_ticks.saturating_sub(previous_sample.process_ticks) as f64;
    let system_delta = current.system_ticks.saturating_sub(previous_sample.system_ticks) as f64;

    *previous = Some(current);

    if system_delta <= 0.0 {
        return Ok(0.0);
    }

    let percent = (process_delta / system_delta) * cpu_count * 100.0;

    Ok(round_two(percent))
}

fn read_process_cpu_ticks() -> Result<u64, String> {
    let stat = fs::read_to_string("/proc/self/stat")
        .map_err(|error| format!("No se pudo leer /proc/self/stat. Detalle: {}", error))?;

    let closing_paren = stat
        .rfind(')')
        .ok_or_else(|| "Formato inválido en /proc/self/stat.".to_string())?;

    let after_name = stat
        .get(closing_paren + 2..)
        .ok_or_else(|| "Formato incompleto en /proc/self/stat.".to_string())?;

    let fields: Vec<&str> = after_name.split_whitespace().collect();

    let utime = fields
        .get(11)
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);

    let stime = fields
        .get(12)
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);

    Ok(utime.saturating_add(stime))
}

fn read_system_cpu_ticks() -> Result<u64, String> {
    let stat = fs::read_to_string("/proc/stat")
        .map_err(|error| format!("No se pudo leer /proc/stat. Detalle: {}", error))?;

    let Some(cpu_line) = stat.lines().find(|line| line.starts_with("cpu ")) else {
        return Ok(0);
    };

    let total = cpu_line
        .split_whitespace()
        .skip(1)
        .filter_map(|value| value.parse::<u64>().ok())
        .fold(0_u64, |acc, value| acc.saturating_add(value));

    Ok(total)
}

fn round_two(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn now_label() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    seconds.to_string()
}