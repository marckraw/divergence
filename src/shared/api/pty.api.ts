import { spawn, type IPty } from "tauri-pty";

interface SpawnPtyBaseOptions {
  cols: number;
  rows: number;
  cwd: string;
  env?: Record<string, string>;
}

interface SpawnTmuxPtyOptions extends SpawnPtyBaseOptions {
  tmuxCommand: string;
  sessionName: string;
  historyLimit: number;
}

export function spawnLoginPty(options: SpawnPtyBaseOptions): IPty {
  return spawn("/bin/zsh", ["-l"], {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
  });
}

export function spawnInteractiveShellPty(options: SpawnPtyBaseOptions): IPty {
  return spawn("/bin/zsh", ["-l", "-i"], {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
  });
}

export function spawnTmuxPty(options: SpawnTmuxPtyOptions): IPty {
  return spawn("/bin/zsh", ["-l", "-i", "-c", options.tmuxCommand], {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: {
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      SHELL: "/bin/zsh",
      DIVERGENCE_APP: "1",
      DIVERGENCE_TMUX_SESSION: options.sessionName,
      DIVERGENCE_TMUX_CWD: options.cwd,
      DIVERGENCE_TMUX_HISTORY_LIMIT: String(options.historyLimit),
      ...options.env,
    },
  });
}
