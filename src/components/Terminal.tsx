import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn } from "tauri-pty";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  cwd: string;
  sessionId: string;
  useTmux?: boolean;
  tmuxSessionName?: string;
  onRegisterCommand?: (sessionId: string, sendCommand: (command: string) => void) => void;
  onUnregisterCommand?: (sessionId: string) => void;
  onStatusChange?: (status: "idle" | "active" | "busy") => void;
  onClose?: () => void;
}

function Terminal({
  cwd,
  sessionId,
  useTmux = false,
  tmuxSessionName,
  onRegisterCommand,
  onUnregisterCommand,
  onStatusChange,
  onClose,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<ReturnType<typeof spawn> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const onStatusChangeRef = useRef<TerminalProps["onStatusChange"]>(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const updateStatus = useCallback((status: "idle" | "active" | "busy") => {
    onStatusChangeRef.current?.(status);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;
    let handleResize: (() => void) | null = null;

    const initTerminal = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initTerminal, 100);
        return;
      }

      initializedRef.current = true;
      console.log(`[${sessionId}] Initializing terminal`);

      // Create terminal - note convertEol for proper line handling
      const terminal = new XTerm({
        convertEol: true,
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: "#181825",
          foreground: "#cdd6f4",
          cursor: "#f5e0dc",
          cursorAccent: "#181825",
          selectionBackground: "#585b7066",
          black: "#45475a",
          red: "#f38ba8",
          green: "#a6e3a1",
          yellow: "#f9e2af",
          blue: "#89b4fa",
          magenta: "#cba6f7",
          cyan: "#94e2d5",
          white: "#bac2de",
          brightBlack: "#585b70",
          brightRed: "#f38ba8",
          brightGreen: "#a6e3a1",
          brightYellow: "#f9e2af",
          brightBlue: "#89b4fa",
          brightMagenta: "#cba6f7",
          brightCyan: "#94e2d5",
          brightWhite: "#a6adc8",
        },
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.open(container);
      fitAddon.fit();

      if (!useTmux) {
        // Ensure scrollback works reliably when not in tmux
        terminal.attachCustomWheelEventHandler((event) => {
          if (event.ctrlKey || event.metaKey) {
            return true;
          }

          const deltaY = event.deltaY;
          if (deltaY === 0) {
            return false;
          }

          // Trackpads can send very small deltas; scale to at least 1 line.
          const lines = Math.max(1, Math.ceil(Math.abs(deltaY) / 20));
          terminal.scrollLines(deltaY > 0 ? lines : -lines);
          return false;
        });
      }

      const spawnShell = () => spawn("/bin/zsh", ["-l", "-i"], {
        cols: terminal.cols,
        rows: terminal.rows,
        cwd,
        env: {
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
        },
      });

      const safeSessionName = (tmuxSessionName || `divergence-${sessionId}`)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      const tmuxCommand = `
if command -v tmux >/dev/null 2>&1; then
  exec tmux new-session -A -s "$DIVERGENCE_TMUX_SESSION" -c "$DIVERGENCE_TMUX_CWD" \\; set -g mouse on
else
  echo "tmux not found, starting zsh"
  exec /bin/zsh -l -i
fi
      `.trim();

      // Spawn PTY - use zsh (login + interactive) to match iTerm behavior
      try {
        const pty = useTmux
          ? spawn("/bin/zsh", ["-l", "-i", "-c", tmuxCommand], {
              cols: terminal.cols,
              rows: terminal.rows,
              cwd,
              env: {
                TERM: "xterm-256color",
                COLORTERM: "truecolor",
                SHELL: "/bin/zsh",
                DIVERGENCE_TMUX_SESSION: safeSessionName,
                DIVERGENCE_TMUX_CWD: cwd,
              },
            })
          : spawnShell();

        ptyRef.current = pty;
        console.log(`[${sessionId}] PTY spawned`);

        const sendCommand = (command: string) => {
          if (!command.trim()) {
            return;
          }
          ptyRef.current?.write(command + "\n");
          updateStatus("busy");
        };
        onRegisterCommand?.(sessionId, sendCommand);

        // Handle PTY output - convert to Uint8Array as per official example
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pty.onData((data: any) => {
          terminal.write(new Uint8Array(data));
          updateStatus("active");

          if (activityTimeoutRef.current) {
            clearTimeout(activityTimeoutRef.current);
          }
          activityTimeoutRef.current = setTimeout(() => {
            updateStatus("idle");
          }, 2000);
        });

        pty.onExit(({ exitCode }: { exitCode: number }) => {
          console.log(`[${sessionId}] PTY exited: ${exitCode}`);
          terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
          updateStatus("idle");
        });

        // Handle terminal input
        terminal.onData((data: string) => {
          pty.write(data);
        });

        // Handle terminal resize
        terminal.onResize((e: { cols: number; rows: number }) => {
          pty.resize(e.cols, e.rows);
        });

        terminal.focus();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[${sessionId}] PTY error:`, err);
        setError(errorMessage);
        terminal.write(`\r\n\x1b[31mFailed to start terminal: ${errorMessage}\x1b[0m\r\n`);
      }

      // Window resize handler
      handleResize = () => {
        fitAddonRef.current?.fit();
        if (terminalRef.current && ptyRef.current) {
          ptyRef.current.resize(terminalRef.current.cols, terminalRef.current.rows);
        }
      };
      window.addEventListener("resize", handleResize);
    };

    initTerminal();

    return () => {
      console.log(`[${sessionId}] Cleanup`);
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      onUnregisterCommand?.(sessionId);
      ptyRef.current?.kill();
      terminalRef.current?.dispose();
      ptyRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [cwd, sessionId, updateStatus, useTmux, tmuxSessionName, onRegisterCommand, onUnregisterCommand]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-main text-red">
        <div className="text-center">
          <p className="text-lg mb-2">Terminal Error</p>
          <p className="text-sm text-subtext">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-surface rounded hover:bg-surface/80 text-text"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden p-2"
      style={{ backgroundColor: "#181825" }}
    />
  );
}

export default Terminal;
