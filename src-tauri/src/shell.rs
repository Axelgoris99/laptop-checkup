//! Runs external tools (PowerShell, netsh, nmcli, smartctl…) without flashing
//! a console window on Windows.

use serde_json::Value;
use std::process::Command;

pub fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().map_err(|e| format!("{program}: {e}"))?;
    if !out.status.success() && out.stdout.is_empty() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() {
            format!("{program} failed")
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Runs a PowerShell pipeline and parses its output as JSON.
pub fn powershell_json(script: &str) -> Result<Value, String> {
    let script = format!(
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8; {script} | ConvertTo-Json -Depth 4 -Compress"
    );
    let out = run(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ],
    )?;
    let out = out.trim();
    if out.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(out).map_err(|e| format!("bad PowerShell output: {e}"))
}

/// ConvertTo-Json emits a bare object for one item and an array for several.
pub fn as_array(v: Value) -> Vec<Value> {
    match v {
        Value::Array(a) => a,
        Value::Null => vec![],
        other => vec![other],
    }
}

pub fn str_field(v: &Value, key: &str) -> Option<String> {
    match v.get(key)? {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

pub fn num_field(v: &Value, key: &str) -> Option<f64> {
    v.get(key)?.as_f64()
}

pub fn windows_only<T>() -> Result<T, String> {
    Err("Only available on Windows".into())
}
