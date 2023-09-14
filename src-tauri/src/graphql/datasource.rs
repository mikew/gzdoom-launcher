use std::fs;
use std::process::Command;
use std::vec;

use async_graphql::Context;
use async_graphql::Error;
use async_graphql::Result as GraphQLResult;
use tauri::api::dir::read_dir;
use tauri::api::dir::DiskEntry;
use tauri::api::shell::open;
use tauri::AppHandle;
use tauri::Manager;

use crate::database::DataBase;
use crate::database::DirectoryManager;
use crate::database::PlaySessionJson;

use super::generated::AppSettings;
use super::generated::Game;
use super::generated::Mutation;
use super::generated::PlaySession;
use super::generated::Query;

pub struct DataSource;

impl DataSource {
  pub async fn Game_play_sessions(
    &self,
    root: &Game,
    _ctx: &Context<'_>,
  ) -> GraphQLResult<Vec<PlaySession>> {
    let play_sessions: Vec<PlaySession> = vec![];

    let meta_path = DirectoryManager::get_meta_directory()
      .join(&root.name)
      .join("playSessions.json");
    let json_contents = fs::read_to_string(meta_path).unwrap_or("{}".to_string());
    let play_session_meta = serde_json::from_str::<PlaySessionJson>(&json_contents).unwrap();

    if play_session_meta.sessions.is_some() {
      let sessions = play_session_meta.sessions.unwrap();
      // TODO Implement ...
      println!("{:?} {:?}", root.name, sessions);
    }

    Ok(play_sessions)
  }

  pub async fn Query_getAppSettings(
    &self,
    _root: &Query,
    _ctx: &Context<'_>,
  ) -> GraphQLResult<AppSettings> {
    Ok(AppSettings {
      dataDirectory: String::from(DirectoryManager::get_data_directory().to_str().unwrap()),
    })
  }

  pub async fn Query_getGameFiles(
    &self,
    _root: &Query,
    _ctx: &Context<'_>,
    _game_id: String,
  ) -> GraphQLResult<Vec<String>> {
    let mut files: Vec<String> = vec![];
    let files_in_game_folder =
      read_dir(DirectoryManager::get_games_directory().join(_game_id), true).unwrap();

    fn recurse_disk_entry(dir: DiskEntry, files: &mut Vec<String>) {
      if let Some(children) = dir.children {
        for d in children {
          recurse_disk_entry(d, files);
        }
      } else {
        files.push(dir.path.to_str().unwrap().to_string());
      }
    }

    for file_disk_entry in files_in_game_folder {
      recurse_disk_entry(file_disk_entry, &mut files);
    }

    Ok(files)
  }

  pub async fn Query_getGames(&self, _root: &Query, ctx: &Context<'_>) -> GraphQLResult<Vec<Game>> {
    let db = ctx.data::<AppHandle>().unwrap().state::<DataBase>();
    let game_cache = db.games_cache.lock().unwrap();

    Ok(game_cache.values().cloned().collect())
  }

  pub async fn Mutation_startGame(
    &self,
    _root: &Mutation,
    _ctx: &Context<'_>,
    files: Option<Vec<String>>,
    iwad: Option<String>,
    source_port: String,
  ) -> GraphQLResult<bool> {
    let mut command = Command::new(source_port);

    if let Some(valid_iwad) = iwad {
      command.args(["-iwad", &valid_iwad]);
    }

    if let Some(valid_files) = files {
      for valid_file in valid_files {
        command.args(["-file", &valid_file]);
      }
    }

    let exit_status = command.status().unwrap();

    Ok(exit_status.success())
  }

  pub async fn Mutation_openGamesFolder(
    &self,
    _root: &Mutation,
    ctx: &Context<'_>,
    game_id: Option<String>,
  ) -> GraphQLResult<bool> {
    let app = ctx.data::<AppHandle>().unwrap();

    let mut path_to_open = DirectoryManager::get_games_directory();

    if game_id.is_some() {
      path_to_open.push(game_id.unwrap());
    }

    open(&app.shell_scope(), path_to_open.to_str().unwrap(), None).unwrap();

    Ok(true)
  }

  pub async fn Mutation_openSourcePortsFolder(
    &self,
    _root: &Mutation,
    _ctx: &Context<'_>,
    _game_id: Option<String>,
  ) -> GraphQLResult<bool> {
    todo!()
  }

  pub async fn Mutation_updateNotes(
    &self,
    _root: &Mutation,
    ctx: &Context<'_>,
    game_id: String,
    notes: String,
  ) -> GraphQLResult<Game> {
    let db = ctx.data::<AppHandle>().unwrap().state::<DataBase>();

    if let Some(mut game) = db.find_game_by_id(game_id) {
      game.notes = notes;

      return Ok(game);
    }

    Err(Error {
      message: "game not found".to_string(),
      source: None,
      extensions: None,
    })
  }

  pub async fn Mutation_initializeApp(
    &self,
    _root: &Mutation,
    ctx: &Context<'_>,
  ) -> GraphQLResult<bool> {
    DirectoryManager::init_games();
    let db = ctx.data::<AppHandle>().unwrap().state::<DataBase>();
    db.initialize_games_cache();

    Ok(true)
  }
}