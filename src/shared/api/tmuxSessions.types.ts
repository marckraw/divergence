export interface TmuxSessionEntry {
  name: string;
  socket_path: string;
  created: string;
  attached: boolean;
  window_count: number;
  activity: string;
}

export interface RawTmuxSessionEntry {
  name: string;
  socket_path: string;
  created: string;
  attached: boolean;
  window_count: number;
  activity: string;
}

export interface TmuxCommandDiagnosticsEntry {
  status_code: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
}

export interface TmuxDiagnosticsEntry {
  resolved_tmux_path: string | null;
  login_shell_path: string | null;
  login_shell_tmux_path: string | null;
  env_path: string | null;
  env_shell: string | null;
  env_tmux: string | null;
  env_tmux_tmpdir: string | null;
  login_shell_tmux_tmpdir: string | null;
  env_tmpdir: string | null;
  login_shell_tmpdir: string | null;
  version: TmuxCommandDiagnosticsEntry;
  list_sessions_raw: TmuxCommandDiagnosticsEntry;
}
