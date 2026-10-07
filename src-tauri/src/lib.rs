use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::{
    env,
    fs::{self, File},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
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

fn sanitize_stage(value: &str) -> String {
    value
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect()
}

fn allowed_extension(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_string_lossy().to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "tif" | "tiff" => Some(ext),
        _ => None,
    }
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

fn find_colmap() -> Result<PathBuf, String> {
    for candidate in [PathBuf::from("/usr/bin/colmap"), PathBuf::from("colmap")] {
        if candidate.is_absolute() && !candidate.exists() {
            continue;
        }
        if Command::new(&candidate).arg("-h").output().is_ok() {
            return Ok(candidate);
        }
    }
    Err(
        "COLMAP was not found. Install SnapFold with its Debian package so the required 'colmap' dependency is installed automatically."
            .to_string(),
    )
}

fn find_named_file(root: &Path, name: &str, depth: usize) -> Option<PathBuf> {
    if depth == 0 || !root.is_dir() {
        return None;
    }
    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.file_name().is_some_and(|v| v == name) {
            return Some(path);
        }
        if path.is_dir() {
            if let Some(found) = find_named_file(&path, name, depth - 1) {
                return Some(found);
            }
        }
    }
    None
}

fn find_openmvs_tool(app: &AppHandle, name: &str) -> Result<(PathBuf, Option<PathBuf>), String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(tool) = find_named_file(&resource_dir, name, 8) {
            return Ok((tool, Some(resource_dir)));
        }
    }

    if Command::new(name).arg("-h").output().is_ok() {
        return Ok((PathBuf::from(name), None));
    }

    Err(format!(
        "The bundled OpenMVS tool '{name}' was not found. Reinstall SnapFold v0.3.0-alpha.4."
    ))
}

fn collect_library_dirs(root: &Path, depth: usize, dirs: &mut Vec<PathBuf>) {
    if depth == 0 || !root.is_dir() {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    let mut this_dir_has_library = false;
    let mut child_dirs = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            child_dirs.push(path);
            continue;
        }
        let name = path
            .file_name()
            .map(|v| v.to_string_lossy())
            .unwrap_or_default();
        if name.ends_with(".so") || name.contains(".so.") {
            this_dir_has_library = true;
        }
    }
    if this_dir_has_library {
        dirs.push(root.to_path_buf());
    }
    for child in child_dirs {
        collect_library_dirs(&child, depth - 1, dirs);
    }
}

fn run_tool(
    app: &AppHandle,
    executable: &Path,
    resource_root: Option<&Path>,
    workspace: &Path,
    stage: &str,
    percent: f64,
    message: &str,
    args: &[String],
    thread_limit: usize,
    timeout: Duration,
) -> Result<String, String> {
    emit_progress(
        app,
        stage,
        percent,
        message,
        Some(format!("{} {}", executable.display(), args.join(" "))),
    );

    let stage_safe = sanitize_stage(stage);
    let stdout_path = workspace.join(format!(".snapfold-{stage_safe}-stdout.log"));
    let stderr_path = workspace.join(format!(".snapfold-{stage_safe}-stderr.log"));

    let stdout_file = File::create(&stdout_path)
        .map_err(|e| format!("{message}: could not create stdout log: {e}"))?;
    let stderr_file = File::create(&stderr_path)
        .map_err(|e| format!("{message}: could not create stderr log: {e}"))?;

    let mut command = Command::new(executable);
    command
        .args(args)
        .current_dir(workspace)
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .env("QT_QPA_PLATFORM", "offscreen")
        .env("OMP_NUM_THREADS", thread_limit.to_string())
        .env("OPENBLAS_NUM_THREADS", thread_limit.to_string())
        .env("MKL_NUM_THREADS", thread_limit.to_string());

    if let Some(root) = resource_root {
        let mut lib_dirs = Vec::new();
        collect_library_dirs(root, 8, &mut lib_dirs);
        if let Some(existing) = env::var_os("LD_LIBRARY_PATH") {
            lib_dirs.extend(env::split_paths(&existing));
        }
        if let Ok(joined) = env::join_paths(lib_dirs) {
            command.env("LD_LIBRARY_PATH", joined);
        }
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("{message}: could not launch {}: {e}", executable.display()))?;

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let stdout = fs::read_to_string(&stdout_path).unwrap_or_default();
                    let stderr = fs::read_to_string(&stderr_path).unwrap_or_default();
                    return Err(format!(
                        "{message} exceeded the {} minute safety limit and was stopped.\n{}",
                        timeout.as_secs() / 60,
                        tail(&format!("{stdout}\n{stderr}"), 7000)
                    ));
                }
                thread::sleep(Duration::from_millis(250));
            }
            Err(e) => {
                let _ = child.kill();
                return Err(format!("{message}: failed while waiting for process: {e}"));
            }
        }
    };

    let stdout = fs::read_to_string(&stdout_path).unwrap_or_default();
    let stderr = fs::read_to_string(&stderr_path).unwrap_or_default();
    let combined = format!("{stdout}\n{stderr}");

    if !status.success() {
        return Err(format!(
            "{message} failed with status {status}.\n{}",
            tail(&combined, 7000)
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

    let colmap = find_colmap()?;
    let (interface_colmap, openmvs_root) = find_openmvs_tool(&app, "InterfaceCOLMAP")?;
    let (densify, _) = find_openmvs_tool(&app, "DensifyPointCloud")?;
    let (reconstruct_mesh, _) = find_openmvs_tool(&app, "ReconstructMesh")?;

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
    let dense_dir = workspace.join("dense");
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

    run_tool(
        &app,
        &colmap,
        None,
        &workspace,
        "features",
        8.0,
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
        1,
        Duration::from_secs(30 * 60),
    )?;

    run_tool(
        &app,
        &colmap,
        None,
        &workspace,
        "matching",
        22.0,
        "Matching photographs geometrically…",
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
        1,
        Duration::from_secs(30 * 60),
    )?;

    run_tool(
        &app,
        &colmap,
        None,
        &workspace,
        "mapping",
        38.0,
        "Solving camera poses, tracks, triangulation, and bundle adjustment…",
        &[
            "mapper".into(),
            "--database_path".into(),
            database_s,
            "--image_path".into(),
            images_s.clone(),
            "--output_path".into(),
            sparse_s,
        ],
        1,
        Duration::from_secs(45 * 60),
    )?;

    let model_dir = best_sparse_model(&sparse_dir)?;
    let sparse_ply = workspace.join("colmap-sparse-points.ply");

    run_tool(
        &app,
        &colmap,
        None,
        &workspace,
        "sparse_export",
        50.0,
        "Exporting the calibrated COLMAP sparse model…",
        &[
            "model_converter".into(),
            "--input_path".into(),
            model_dir.to_string_lossy().to_string(),
            "--output_path".into(),
            sparse_ply.to_string_lossy().to_string(),
            "--output_type".into(),
            "PLY".into(),
        ],
        1,
        Duration::from_secs(10 * 60),
    )?;

    fs::create_dir_all(&dense_dir)
        .map_err(|e| format!("Could not create dense workspace: {e}"))?;

    run_tool(
        &app,
        &colmap,
        None,
        &workspace,
        "undistort",
        56.0,
        "Undistorting calibrated photographs for dense reconstruction…",
        &[
            "image_undistorter".into(),
            "--image_path".into(),
            images_s,
            "--input_path".into(),
            model_dir.to_string_lossy().to_string(),
            "--output_path".into(),
            dense_dir.to_string_lossy().to_string(),
            "--output_type".into(),
            "COLMAP".into(),
            "--max_image_size".into(),
            "1600".into(),
        ],
        1,
        Duration::from_secs(20 * 60),
    )?;

    run_tool(
        &app,
        &interface_colmap,
        openmvs_root.as_deref(),
        &workspace,
        "openmvs_import",
        62.0,
        "Transferring calibrated cameras into OpenMVS…",
        &[
            "-i".into(),
            dense_dir.to_string_lossy().to_string(),
            "-o".into(),
            "scene.mvs".into(),
            "--image-folder".into(),
            "images".into(),
            "--max-threads".into(),
            "1".into(),
        ],
        1,
        Duration::from_secs(15 * 60),
    )?;

    // OpenMVS CPU SGM is explicitly two-stage:
    //   -1 computes and saves disparity maps
    //   -2 fuses those saved disparity maps into a dense point cloud.
    // Calling -2 directly produces no dense depths.
    run_tool(
        &app,
        &densify,
        openmvs_root.as_deref(),
        &workspace,
        "sgm_disparity",
        68.0,
        "Computing CPU SGM disparity maps with OpenMVS…",
        &[
            "scene.mvs".into(),
            "-o".into(),
            "scene_sgm.mvs".into(),
            "--fusion-mode".into(),
            "-1".into(),
            "--resolution-level".into(),
            "2".into(),
            "--max-resolution".into(),
            "1200".into(),
            "--min-resolution".into(),
            "320".into(),
            "--number-views".into(),
            "4".into(),
            "--max-threads".into(),
            "2".into(),
        ],
        2,
        Duration::from_secs(90 * 60),
    )?;

    run_tool(
        &app,
        &densify,
        openmvs_root.as_deref(),
        &workspace,
        "sgm_fusion",
        82.0,
        "Fusing OpenMVS SGM disparity maps into a dense point cloud…",
        &[
            "scene.mvs".into(),
            "-o".into(),
            "scene_dense.mvs".into(),
            "--fusion-mode".into(),
            "-2".into(),
            "--resolution-level".into(),
            "2".into(),
            "--max-resolution".into(),
            "1200".into(),
            "--min-resolution".into(),
            "320".into(),
            "--number-views".into(),
            "4".into(),
            "--max-threads".into(),
            "2".into(),
            "--estimate-colors".into(),
            "2".into(),
            "--estimate-normals".into(),
            "2".into(),
        ],
        2,
        Duration::from_secs(45 * 60),
    )?;

    let dense_ply = workspace.join("scene_dense.ply");
    let dense_bytes = fs::read(&dense_ply)
        .map_err(|e| format!("OpenMVS reported dense reconstruction success, but scene_dense.ply could not be read: {e}"))?;
    let (point_count, _) = parse_ply_counts(&dense_bytes);
    if point_count < 100 {
        return Err(format!(
            "OpenMVS dense reconstruction produced only {point_count} points. The photographs did not yield a usable dense model."
        ));
    }

    run_tool(
        &app,
        &reconstruct_mesh,
        openmvs_root.as_deref(),
        &workspace,
        "mesh",
        93.0,
        "Reconstructing the dense surface mesh…",
        &[
            "scene_dense.mvs".into(),
            "-p".into(),
            "scene_dense.ply".into(),
            "-o".into(),
            "scene_mesh.mvs".into(),
            "--max-threads".into(),
            "2".into(),
            "--target-face-num".into(),
            "200000".into(),
        ],
        2,
        Duration::from_secs(60 * 60),
    )?;

    let mesh_ply = workspace.join("scene_mesh.ply");
    let mesh_bytes = fs::read(&mesh_ply)
        .map_err(|e| format!("OpenMVS reported mesh success, but scene_mesh.ply could not be read: {e}"))?;
    let (_, face_count) = parse_ply_counts(&mesh_bytes);
    if face_count == 0 {
        return Err("OpenMVS produced a mesh file with zero faces.".to_string());
    }

    emit_progress(
        &app,
        "complete",
        100.0,
        "Dense OpenMVS reconstruction ready.",
        None,
    );

    Ok(ReconstructionResult {
        input_image_count: image_paths.len(),
        point_count,
        face_count,
        point_ply_base64: BASE64.encode(dense_bytes),
        mesh_ply_base64: Some(BASE64.encode(mesh_bytes)),
        workspace_path: workspace.to_string_lossy().to_string(),
        engine_label: "COLMAP 3.9.1 + OpenMVS 2.4.0 CPU SGM".to_string(),
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
