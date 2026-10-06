use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    running: bool,
    stage: String,
    percent: f64,
    message: String,
    detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReconstructionResult {
    input_image_count: usize,
    point_count: usize,
    face_count: usize,
    point_ply_base64: String,
    mesh_ply_base64: Option<String>,
    workspace_path: String,
    engine_label: String,
}

fn emit_progress(
    app: &AppHandle,
    stage: &str,
    percent: f64,
    message: impl Into<String>,
    detail: Option<String>,
) {
    let _ = app.emit(
        "snapfold://reconstruction-progress",
        ProgressEvent {
            running: percent < 100.0,
            stage: stage.to_string(),
            percent,
            message: message.into(),
            detail,
        },
    );
}

fn sanitize_project_name(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else if c.is_whitespace() {
                '-'
            } else {
                '_'
            }
        })
        .collect();

    let trimmed = cleaned.trim_matches(&['-', '_'][..]);
    if trimmed.is_empty() {
        "snapfold-project".to_string()
    } else {
        trimmed.chars().take(64).collect()
    }
}

fn allowed_extension(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_string_lossy().to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "tif" | "tiff" => Some(ext),
        _ => None,
    }
}

fn find_colmap(_app: &AppHandle) -> Result<(PathBuf, Option<PathBuf>), String> {
    for candidate in [PathBuf::from("/usr/bin/colmap"), PathBuf::from("colmap")] {
        if candidate.is_absolute() && !candidate.exists() {
            continue;
        }

        let output = Command::new(&candidate).arg("-h").output();
        if matches!(output, Ok(ref value) if value.status.success()) {
            return Ok((candidate, None));
        }
    }

    Err(
        "COLMAP was not found. Install SnapFold with its Debian package so the required 'colmap' dependency is installed automatically."
            .to_string(),
    )
}

fn tail(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    value
        .chars()
        .rev()
        .take(max_chars)
        .collect::<String>()
        .chars()
        .rev()
        .collect()
}

fn run_colmap(
    app: &AppHandle,
    executable: &Path,
    env_root: Option<&Path>,
    workspace: &Path,
    stage: &str,
    percent: f64,
    message: &str,
    args: &[String],
) -> Result<String, String> {
    emit_progress(
        app,
        stage,
        percent,
        message,
        Some(format!("colmap {}", args.join(" "))),
    );

    let mut command = Command::new(executable);
    command.args(args).current_dir(workspace);
    let _ = env_root;
    command.env("QT_QPA_PLATFORM", "offscreen");
    // Keep native numerical libraries from multiplying the memory footprint
    // behind COLMAP's own thread controls. This is deliberately conservative
    // for laptops and lower-memory Linux machines.
    command.env("OMP_NUM_THREADS", "1");
    command.env("OPENBLAS_NUM_THREADS", "1");
    command.env("MKL_NUM_THREADS", "1");

    let output = command
        .output()
        .map_err(|e| format!("{message}: could not launch COLMAP: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}\n{stderr}");

    if !output.status.success() {
        return Err(format!(
            "{message} failed with status {}.\n{}",
            output.status,
            tail(&combined, 6000)
        ));
    }

    Ok(combined)
}

fn best_sparse_model(sparse_root: &Path) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    let entries = fs::read_dir(sparse_root)
        .map_err(|e| format!("COLMAP produced no readable sparse directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let points = path.join("points3D.bin");
        if points.exists() {
            let size = points.metadata().map(|m| m.len()).unwrap_or(0);
            candidates.push((size, path));
        }
    }

    candidates
        .into_iter()
        .max_by_key(|(size, _)| *size)
        .map(|(_, path)| path)
        .ok_or_else(|| {
            "COLMAP could not reconstruct a sparse model from these photographs. No points3D model was produced."
                .to_string()
        })
}

fn parse_ply_counts(bytes: &[u8]) -> (usize, usize) {
    let header_len = bytes.len().min(32768);
    let header = String::from_utf8_lossy(&bytes[..header_len]);
    let mut vertices = 0usize;
    let mut faces = 0usize;

    for line in header.lines() {
        let mut parts = line.split_whitespace();
        match (parts.next(), parts.next(), parts.next()) {
            (Some("element"), Some("vertex"), Some(count)) => {
                vertices = count.parse().unwrap_or(0);
            }
            (Some("element"), Some("face"), Some(count)) => {
                faces = count.parse().unwrap_or(0);
            }
            _ => {}
        }
        if line.trim() == "end_header" {
            break;
        }
    }

    (vertices, faces)
}

fn reconstruct_blocking(
    app: AppHandle,
    image_paths: Vec<String>,
    project_name: String,
) -> Result<ReconstructionResult, String> {
    if image_paths.len() < 3 {
        return Err("Select at least three overlapping photographs.".to_string());
    }

    emit_progress(
        &app,
        "prepare",
        2.0,
        "Preparing native reconstruction workspace…",
        None,
    );

    let (colmap, env_root) = find_colmap(&app)?;

    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Could not create SnapFold application data directory: {e}"))?
        .join("reconstructions");

    fs::create_dir_all(&root)
        .map_err(|e| format!("Could not create reconstruction directory: {e}"))?;

    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let workspace = root.join(format!(
        "{}-{millis}",
        sanitize_project_name(&project_name)
    ));
    let images_dir = workspace.join("images");
    let sparse_dir = workspace.join("sparse");
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Could not create images directory: {e}"))?;
    fs::create_dir_all(&sparse_dir)
        .map_err(|e| format!("Could not create sparse directory: {e}"))?;

    for (index, input) in image_paths.iter().enumerate() {
        let source = PathBuf::from(input);
        if !source.is_file() {
            return Err(format!("Selected photograph does not exist: {}", source.display()));
        }
        let ext = allowed_extension(&source).ok_or_else(|| {
            format!(
                "Unsupported desktop reconstruction image format: {}",
                source.display()
            )
        })?;
        let destination = images_dir.join(format!("image_{:04}.{}", index + 1, ext));
        fs::copy(&source, &destination).map_err(|e| {
            format!(
                "Could not copy {} into the reconstruction workspace: {e}",
                source.display()
            )
        })?;
    }

    let database = workspace.join("database.db");
    let database_s = database.to_string_lossy().to_string();
    let images_s = images_dir.to_string_lossy().to_string();
    let sparse_s = sparse_dir.to_string_lossy().to_string();

    run_colmap(
        &app,
        &colmap,
        env_root.as_deref(),
        &workspace,
        "features",
        10.0,
        "Extracting COLMAP SIFT features on CPU…",
        &[
            "feature_extractor".into(),
            "--database_path".into(),
            database_s.clone(),
            "--image_path".into(),
            images_s.clone(),
            "--ImageReader.single_camera".into(),
            "1".into(),
            "--ImageReader.camera_model".into(),
            "SIMPLE_RADIAL".into(),
            "--SiftExtraction.use_gpu".into(),
            "0".into(),
            "--SiftExtraction.num_threads".into(),
            "1".into(),
            "--SiftExtraction.max_image_size".into(),
            "1200".into(),
            "--SiftExtraction.max_num_features".into(),
            "4096".into(),
        ],
    )?;

    run_colmap(
        &app,
        &colmap,
        env_root.as_deref(),
        &workspace,
        "matching",
        32.0,
        "Exhaustively matching the photographs…",
        &[
            "exhaustive_matcher".into(),
            "--database_path".into(),
            database_s.clone(),
            "--SiftMatching.use_gpu".into(),
            "0".into(),
            "--SiftMatching.num_threads".into(),
            "1".into(),
            "--SiftMatching.guided_matching".into(),
            "1".into(),
        ],
    )?;

    run_colmap(
        &app,
        &colmap,
        env_root.as_deref(),
        &workspace,
        "mapping",
        56.0,
        "Solving camera poses, tracks, triangulation, and bundle adjustment…",
        &[
            "mapper".into(),
            "--database_path".into(),
            database_s,
            "--image_path".into(),
            images_s,
            "--output_path".into(),
            sparse_s,
        ],
    )?;

    let model_dir = best_sparse_model(&sparse_dir)?;
    let point_ply = workspace.join("colmap-sparse-points.ply");

    run_colmap(
        &app,
        &colmap,
        env_root.as_deref(),
        &workspace,
        "export",
        84.0,
        "Exporting the COLMAP point cloud…",
        &[
            "model_converter".into(),
            "--input_path".into(),
            model_dir.to_string_lossy().to_string(),
            "--output_path".into(),
            point_ply.to_string_lossy().to_string(),
            "--output_type".into(),
            "PLY".into(),
        ],
    )?;

    let point_bytes = fs::read(&point_ply)
        .map_err(|e| format!("Could not read COLMAP PLY output: {e}"))?;
    let (point_count, _) = parse_ply_counts(&point_bytes);

    if point_count == 0 {
        return Err("COLMAP produced a model, but the exported point cloud contains zero vertices.".to_string());
    }

    let mesh_ply = workspace.join("colmap-sparse-mesh.ply");
    emit_progress(
        &app,
        "meshing",
        91.0,
        "Attempting a visibility-aware Delaunay surface…",
        None,
    );

    let mesh_attempt = run_colmap(
        &app,
        &colmap,
        env_root.as_deref(),
        &workspace,
        "meshing",
        91.0,
        "Attempting a visibility-aware Delaunay surface…",
        &[
            "delaunay_mesher".into(),
            "--input_path".into(),
            model_dir.to_string_lossy().to_string(),
            "--output_path".into(),
            mesh_ply.to_string_lossy().to_string(),
            "--input_type".into(),
            "sparse".into(),
        ],
    );

    let (mesh_ply_base64, face_count) = if mesh_attempt.is_ok() && mesh_ply.exists() {
        match fs::read(&mesh_ply) {
            Ok(bytes) => {
                let (_, faces) = parse_ply_counts(&bytes);
                if faces > 0 {
                    (Some(BASE64.encode(bytes)), faces)
                } else {
                    (None, 0)
                }
            }
            Err(_) => (None, 0),
        }
    } else {
        if let Err(detail) = mesh_attempt {
            emit_progress(
                &app,
                "meshing",
                95.0,
                "Sparse point cloud is valid; optional sparse meshing was skipped.",
                Some(tail(&detail, 1400)),
            );
        }
        (None, 0)
    };

    emit_progress(
        &app,
        "complete",
        100.0,
        "COLMAP reconstruction ready.",
        None,
    );

    Ok(ReconstructionResult {
        input_image_count: image_paths.len(),
        point_count,
        face_count,
        point_ply_base64: BASE64.encode(point_bytes),
        mesh_ply_base64,
        workspace_path: workspace.to_string_lossy().to_string(),
        engine_label: "COLMAP 3.9.1 CPU (Ubuntu Noble)".to_string(),
    })
}

#[tauri::command]
async fn reconstruct_colmap(
    app: AppHandle,
    image_paths: Vec<String>,
    project_name: String,
) -> Result<ReconstructionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        reconstruct_blocking(app, image_paths, project_name)
    })
    .await
    .map_err(|e| format!("Reconstruction worker failed: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![reconstruct_colmap])
        .run(tauri::generate_context!())
        .expect("error while running SnapFold");
}
