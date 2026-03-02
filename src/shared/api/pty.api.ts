import { spawn, type IPty } from "tauri-pty";

export type PtyProcess = IPty;

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

interface RunLoginShellCommandOptions {
  cwd: string;
  command: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  outputLimitChars?: number;
  outputTailChars?: number;
  outputUpdateIntervalMs?: number;
  onOutputUpdate?: (outputTail: string) => void;
}

export interface RunLoginShellCommandResult {
  exitCode: number;
  output: string;
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
  // Tmux bootstrap does not need an interactive shell; skipping `-i` avoids slow plugin startup.
  return spawn("/bin/zsh", ["-l", "-c", options.tmuxCommand], {
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

export async function runLoginShellCommand(
  options: RunLoginShellCommandOptions
): Promise<RunLoginShellCommandResult> {
  const timeoutMs = options.timeoutMs ?? 1000 * 60 * 20;
  const outputLimitChars = options.outputLimitChars ?? 20_000;
  const outputTailChars = options.outputTailChars ?? 4000;
  const outputUpdateIntervalMs = options.outputUpdateIntervalMs ?? 600;
  const decoder = new TextDecoder();

  return new Promise((resolve, reject) => {
    const pty = spawn("/bin/zsh", ["-l", "-c", options.command], {
      cols: 120,
      rows: 24,
      cwd: options.cwd,
      env: {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        SHELL: "/bin/zsh",
        DIVERGENCE_APP: "1",
        ...options.env,
      },
    });

    let output = "";
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastOutputEmitAt = 0;

    const emitOutput = (force = false) => {
      if (!options.onOutputUpdate) {
        return;
      }
      const now = Date.now();
      if (!force && now - lastOutputEmitAt < outputUpdateIntervalMs) {
        return;
      }
      lastOutputEmitAt = now;
      const outputTail = output.length > outputTailChars
        ? output.slice(output.length - outputTailChars)
        : output;
      try {
        options.onOutputUpdate(outputTail);
      } catch {
        // Ignore callback errors to avoid interrupting command execution.
      }
    };

    const dataDisposable = pty.onData((chunk: Uint8Array) => {
      output += decoder.decode(chunk, { stream: true });
      if (output.length > outputLimitChars) {
        output = output.slice(output.length - outputLimitChars);
      }
      emitOutput();
    });

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      dataDisposable.dispose();
      exitDisposable.dispose();
      try {
        pty.kill();
      } catch {
        // Ignore kill errors; process may have already exited.
      }
    };

    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      emitOutput(true);
      cleanup();
      handler();
    };

    const exitDisposable = pty.onExit(({ exitCode }: { exitCode: number }) => {
      settle(() => {
        output += decoder.decode();
        resolve({
          exitCode,
          output: output.trim(),
        });
      });
    });

    timeout = setTimeout(() => {
      settle(() => {
        reject(new Error(`Command timed out after ${Math.round(timeoutMs / 1000)}s.`));
      });
    }, timeoutMs);
  });
}
