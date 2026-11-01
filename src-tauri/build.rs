use std::fs;

fn main() {
    // `generate_context!` needs the frontend folder to exist, so Rust checks
    // can run before (or without) a frontend build.
    fs::create_dir_all("../dist").expect("create the frontend dist folder");
    tauri_build::build();
}
