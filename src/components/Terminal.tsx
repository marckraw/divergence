import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { spawn } from "tauri-pty";
import { DEFAULT_TMUX_HISTORY_LIMIT } from "../lib/appSettings";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  cwd: string;
  sessionId: string;
  useTmux?: boolean;
  tmuxSessionName?: string;
  tmuxHistoryLimit?: number;
  useWebgl?: boolean;
  selectToCopy?: boolean;
  onRendererChange?: (renderer: "webgl" | "canvas") => void;
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
  tmuxHistoryLimit,
  useWebgl = true,
  selectToCopy = true,
  onRendererChange,
  onRegisterCommand,
  onUnregisterCommand,
  onStatusChange,
  onClose,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const ptyRef = useRef<ReturnType<typeof spawn> | null>(null);
  const isDisposedRef = useRef(false);
  const ptyDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const ptyExitDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const terminalDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const terminalResizeDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const terminalFocusDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const initRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeDisabledRef = useRef(false);
    const selectToCopyRef = useRef(selectToCopy);
    const selectionDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const selectionDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const onStatusChangeRef = useRef<TerminalProps["onStatusChange"]>(onStatusChange);
  const onRendererChangeRef = useRef<TerminalProps["onRendererChange"]>(onRendererChange);
  const statusRef = useRef<"idle" | "active" | "busy">("idle");
  const lastActiveUpdateRef = useRef(0);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onRendererChangeRef.current = onRendererChange;
  }, [onRendererChange]);

  useEffect(() => {
    selectToCopyRef.current = selectToCopy;
  }, [selectToCopy]);

  const updateStatus = useCallback((status: "idle" | "active" | "busy") => {
    if (statusRef.current === status) {
      return;
    }
    statusRef.current = status;
    onStatusChangeRef.current?.(status);
  }, []);

  const tryResumePty = useCallback(() => {
    if (resumeDisabledRef.current) {
      return;
    }
    const pty = ptyRef.current;
    if (!pty || typeof pty.resume !== "function") {
      resumeDisabledRef.current = true;
      return;
    }
    try {
      pty.resume();
    } catch (err) {
      resumeDisabledRef.current = true;
      console.warn(`[${sessionId}] PTY resume not available`, err);
    }
  }, [sessionId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;
    isDisposedRef.current = false;
    let handleResize: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

      const disposeWebgl = () => {
        if (webglAddonRef.current) {
          try {
            webglAddonRef.current.dispose();
          } catch (err) {
            console.warn(`[${sessionId}] Failed to dispose WebGL addon`, err);
        }
        webglAddonRef.current = null;
      }
    };

    const initTerminal = () => {
      if (initializedRef.current || isDisposedRef.current) {
        return;
      }
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (!initRetryTimeoutRef.current) {
          initRetryTimeoutRef.current = setTimeout(() => {
            initRetryTimeoutRef.current = null;
            initTerminal();
          }, 100);
        }
        return;
      }

      if (initRetryTimeoutRef.current) {
        clearTimeout(initRetryTimeoutRef.current);
        initRetryTimeoutRef.current = null;
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

      if (useWebgl) {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            console.warn(`[${sessionId}] WebGL context lost, falling back to Canvas`);
            disposeWebgl();
            onRendererChangeRef.current?.("canvas");
          });
          terminal.loadAddon(webglAddon);
          webglAddonRef.current = webglAddon;
          onRendererChangeRef.current?.("webgl");
        } catch (err) {
          console.warn(`[${sessionId}] WebGL init failed, using Canvas renderer`, err);
          disposeWebgl();
          onRendererChangeRef.current?.("canvas");
        }
      } else {
        disposeWebgl();
        onRendererChangeRef.current?.("canvas");
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.open(container);
      fitAddon.fit();
      if (terminal.element) {
        const handleFocus = () => {
          tryResumePty();
        };
        terminal.element.addEventListener("focusin", handleFocus);
        terminalFocusDisposableRef.current = {
          dispose: () => terminal.element?.removeEventListener("focusin", handleFocus),
        };
      }

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (isDisposedRef.current) {
            return;
          }
          fitAddonRef.current?.fit();
          if (terminalRef.current && ptyRef.current) {
            ptyRef.current.resize(terminalRef.current.cols, terminalRef.current.rows);
          }
        });
        resizeObserver.observe(container);
      }

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
  exec tmux new-session -A -s "$DIVERGENCE_TMUX_SESSION" -c "$DIVERGENCE_TMUX_CWD" \\; set -g mouse on \\; set -t "$DIVERGENCE_TMUX_SESSION" history-limit "$DIVERGENCE_TMUX_HISTORY_LIMIT"
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
                DIVERGENCE_TMUX_HISTORY_LIMIT: String(tmuxHistoryLimit ?? DEFAULT_TMUX_HISTORY_LIMIT),
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
        ptyDataDisposableRef.current = pty.onData((data: any) => {
          if (isDisposedRef.current || !terminalRef.current) {
            return;
          }
          terminal.write(new Uint8Array(data));
          const now = Date.now();
          if (statusRef.current !== "active" || now - lastActiveUpdateRef.current > 500) {
            lastActiveUpdateRef.current = now;
            updateStatus("active");
          }

          if (activityTimeoutRef.current) {
            clearTimeout(activityTimeoutRef.current);
          }
          activityTimeoutRef.current = setTimeout(() => {
            updateStatus("idle");
          }, 2000);
        });

        ptyExitDisposableRef.current = pty.onExit(({ exitCode }: { exitCode: number }) => {
          if (isDisposedRef.current || !terminalRef.current) {
            return;
          }
          console.log(`[${sessionId}] PTY exited: ${exitCode}`);
          terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
          updateStatus("idle");
        });

        // Handle terminal input
        terminalDataDisposableRef.current = terminal.onData((data: string) => {
          if (isDisposedRef.current) {
            return;
          }
          pty.write(data);
          if (data.includes("\r") || data.includes("\n")) {
            updateStatus("busy");
          }
        });

        // Handle terminal resize
        terminalResizeDisposableRef.current = terminal.onResize((e: { cols: number; rows: number }) => {
          if (isDisposedRef.current) {
            return;
          }
          pty.resize(e.cols, e.rows);
        });

        terminal.focus();

        // Select-to-copy: on selection change, debounce and copy to clipboard
        selectionDisposableRef.current = terminal.onSelectionChange(() => {
          if (selectionDebounceTimerRef.current) {
            clearTimeout(selectionDebounceTimerRef.current);
          }
          selectionDebounceTimerRef.current = setTimeout(() => {
            if (!selectToCopyRef.current) return;
            const selection = terminal.getSelection();
            if (!selection) return;
            writeText(selection).catch((err) => {
              console.warn(`[${sessionId}] Failed to copy selection to clipboard:`, err);
            });
          }, 150);
        });
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
      statusRef.current = "idle";
      isDisposedRef.current = true;
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (selectionDebounceTimerRef.current) {
        clearTimeout(selectionDebounceTimerRef.current);
      }
      selectionDisposableRef.current?.dispose();
      selectionDisposableRef.current = null;
      disposeWebgl();
      if (initRetryTimeoutRef.current) {
        clearTimeout(initRetryTimeoutRef.current);
        initRetryTimeoutRef.current = null;
      }
      ptyDataDisposableRef.current?.dispose();
      ptyDataDisposableRef.current = null;
      ptyExitDisposableRef.current?.dispose();
      ptyExitDisposableRef.current = null;
      terminalDataDisposableRef.current?.dispose();
      terminalDataDisposableRef.current = null;
      terminalResizeDisposableRef.current?.dispose();
      terminalResizeDisposableRef.current = null;
      terminalFocusDisposableRef.current?.dispose();
      terminalFocusDisposableRef.current = null;
      onUnregisterCommand?.(sessionId);
      ptyRef.current?.kill();
      terminalRef.current?.dispose();
      ptyRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
      resumeDisabledRef.current = false;
    };
  }, [cwd, sessionId, updateStatus, useTmux, tmuxSessionName, useWebgl, onRegisterCommand, onUnregisterCommand, tryResumePty]);

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
      onMouseDown={() => {
        terminalRef.current?.focus();
        tryResumePty();
      }}
    />
  );
}

export default Terminal;
