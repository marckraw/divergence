import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { DEFAULT_TMUX_HISTORY_LIMIT } from "../../../shared";
import "@xterm/xterm/css/xterm.css";
import { useAppSettings } from "../../../shared";
import {
  type PtyProcess,
  spawnInteractiveShellPty,
  spawnTmuxPty,
} from "../../../shared/api/pty.api";
import {
  buildTmuxBootstrapCommand,
  sanitizeTmuxSessionNameForShell,
  TMUX_BOOTSTRAP_TIMEOUT_MS,
  buildBootstrapTimeoutMessage,
} from "../lib/terminalTmux.pure";
import {
  shouldAutoReconnect,
  getReconnectDelayMs,
} from "../lib/terminalReconnect.pure";
import TerminalPresentational from "./Terminal.presentational";

const SPAWN_DEBOUNCE_MS = 50;

interface TerminalProps {
  cwd: string;
  sessionId: string;
  useTmux?: boolean;
  tmuxSessionName?: string;
  tmuxHistoryLimit?: number;
  onRegisterCommand?: (sessionId: string, sendCommand: (command: string) => void) => void;
  onUnregisterCommand?: (sessionId: string) => void;
  onStatusChange?: (status: "idle" | "active" | "busy") => void;
  onReconnect?: () => void;
  onClose?: () => void;
}

const TERMINAL_THEME_DARK: ITheme = {
  background: "#181825",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  cursorAccent: "#181825",
  selectionBackground: "rgba(88, 91, 112, 0.4)",
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
};

const TERMINAL_THEME_LIGHT: ITheme = {
  background: "#f8f9fc",
  foreground: "#4c4f69",
  cursor: "#2d6cdf",
  cursorAccent: "#f8f9fc",
  selectionBackground: "rgba(45, 108, 223, 0.18)",
  black: "#5c5f77",
  red: "#d20f39",
  green: "#40a02b",
  yellow: "#df8e1d",
  blue: "#1e66f5",
  magenta: "#8839ef",
  cyan: "#179299",
  white: "#bcc0cc",
  brightBlack: "#6c6f85",
  brightRed: "#d20f39",
  brightGreen: "#40a02b",
  brightYellow: "#df8e1d",
  brightBlue: "#1e66f5",
  brightMagenta: "#8839ef",
  brightCyan: "#179299",
  brightWhite: "#4c4f69",
};

const getTerminalTheme = (mode: "dark" | "light") =>
  mode === "light" ? TERMINAL_THEME_LIGHT : TERMINAL_THEME_DARK;

function Terminal({
  cwd,
  sessionId,
  useTmux = false,
  tmuxSessionName,
  tmuxHistoryLimit,
  onRegisterCommand,
  onUnregisterCommand,
  onStatusChange,
  onReconnect,
  onClose,
}: TerminalProps) {
  const { settings: appSettings } = useAppSettings();
  const themeMode = appSettings.theme === "light" ? "light" : "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<PtyProcess | null>(null);
  const isDisposedRef = useRef(false);
  const ptyDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const ptyExitDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const terminalDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const terminalResizeDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const initRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const onStatusChangeRef = useRef<TerminalProps["onStatusChange"]>(onStatusChange);
  const onReconnectRef = useRef(onReconnect);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedDataRef = useRef(false);
  const statusRef = useRef<"idle" | "active" | "busy">("idle");
  const lastActiveUpdateRef = useRef(0);
  const themeModeRef = useRef<"dark" | "light">(themeMode);

  useEffect(() => {
    themeModeRef.current = themeMode;
  }, [themeMode]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const updateStatus = useCallback((status: "idle" | "active" | "busy") => {
    if (statusRef.current === status) {
      return;
    }
    statusRef.current = status;
    onStatusChangeRef.current?.(status);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;
    isDisposedRef.current = false;
    let handleResize: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

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

      // Phase 1 (immediate): Create XTerm, open in container, set up ResizeObserver
      const terminal = new XTerm({
        convertEol: true,
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
        theme: getTerminalTheme(themeModeRef.current),
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.open(container);
      fitAddon.fit();
      terminal.write("\x1b[90mConnecting...\x1b[0m");

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
        terminal.attachCustomWheelEventHandler((event) => {
          if (event.ctrlKey || event.metaKey) {
            return true;
          }

          const deltaY = event.deltaY;
          if (deltaY === 0) {
            return false;
          }

          const lines = Math.max(1, Math.ceil(Math.abs(deltaY) / 20));
          terminal.scrollLines(deltaY > 0 ? lines : -lines);
          return false;
        });
      }

      // Window resize handler
      handleResize = () => {
        fitAddonRef.current?.fit();
        if (terminalRef.current && ptyRef.current) {
          ptyRef.current.resize(terminalRef.current.cols, terminalRef.current.rows);
        }
      };
      window.addEventListener("resize", handleResize);

      // Phase 2 (debounced): Spawn PTY after short delay to survive StrictMode unmount
      spawnTimerRef.current = setTimeout(() => {
        spawnTimerRef.current = null;
        if (isDisposedRef.current) {
          return;
        }

        const spawnShell = () => spawnInteractiveShellPty({
          cols: terminal.cols,
          rows: terminal.rows,
          cwd,
          env: {
            TERM: "xterm-256color",
            COLORTERM: "truecolor",
            DIVERGENCE_APP: "1",
          },
        });

        const safeSessionName = sanitizeTmuxSessionNameForShell(tmuxSessionName, sessionId);
        const tmuxCommand = buildTmuxBootstrapCommand();

        try {
          const pty = useTmux
            ? spawnTmuxPty({
                cols: terminal.cols,
                rows: terminal.rows,
                cwd,
                tmuxCommand,
                sessionName: safeSessionName,
                historyLimit: tmuxHistoryLimit ?? DEFAULT_TMUX_HISTORY_LIMIT,
                env: {
                  DIVERGENCE_APP: "1",
                },
              })
            : spawnShell();

          ptyRef.current = pty;
          hasReceivedDataRef.current = false;
          console.log(`[${sessionId}] PTY spawned`);
          terminal.write("\r\x1b[2K");

          if (useTmux) {
            startupTimerRef.current = setTimeout(() => {
              startupTimerRef.current = null;
              if (isDisposedRef.current || hasReceivedDataRef.current) {
                return;
              }
              console.warn(`[${sessionId}] tmux bootstrap timeout`);
              terminal.write(`\r\n\x1b[33m${buildBootstrapTimeoutMessage(TMUX_BOOTSTRAP_TIMEOUT_MS)}\x1b[0m\r\n`);
              onReconnectRef.current?.();
            }, TMUX_BOOTSTRAP_TIMEOUT_MS);
          }

          const sendCommand = (command: string) => {
            if (!command.trim()) {
              return;
            }
            ptyRef.current?.write(command + "\n");
            updateStatus("busy");
          };
          onRegisterCommand?.(sessionId, sendCommand);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ptyDataDisposableRef.current = pty.onData((data: any) => {
            if (isDisposedRef.current || !terminalRef.current) {
              return;
            }
            if (!hasReceivedDataRef.current) {
              hasReceivedDataRef.current = true;
              if (startupTimerRef.current) {
                clearTimeout(startupTimerRef.current);
                startupTimerRef.current = null;
              }
            }
            reconnectAttemptRef.current = 0;
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

            const attempt = reconnectAttemptRef.current;
            if (shouldAutoReconnect(exitCode, useTmux, attempt)) {
              const delayMs = getReconnectDelayMs(attempt);
              const delaySec = Math.round(delayMs / 1000);
              terminal.write(`\x1b[33m[Reconnecting in ${delaySec}s... (attempt ${attempt + 1})]\x1b[0m\r\n`);
              reconnectAttemptRef.current = attempt + 1;
              reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null;
                if (!isDisposedRef.current) {
                  onReconnectRef.current?.();
                }
              }, delayMs);
            } else if (exitCode !== 0) {
              terminal.write("\x1b[33m[Max reconnect attempts reached. Reconnect manually.]\x1b[0m\r\n");
            }
          });

          terminalDataDisposableRef.current = terminal.onData((data: string) => {
            if (isDisposedRef.current) {
              return;
            }
            pty.write(data);
            if (data.includes("\r") || data.includes("\n")) {
              updateStatus("busy");
            }
          });

          terminalResizeDisposableRef.current = terminal.onResize((e: { cols: number; rows: number }) => {
            if (isDisposedRef.current) {
              return;
            }
            pty.resize(e.cols, e.rows);
          });

          terminal.focus();

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[${sessionId}] PTY error:`, err);
          setError(errorMessage);
          terminal.write(`\r\n\x1b[31mFailed to start terminal: ${errorMessage}\x1b[0m\r\n`);
        }
      }, SPAWN_DEBOUNCE_MS);
    };

    initTerminal();

    return () => {
      console.log(`[${sessionId}] Cleanup`);
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (startupTimerRef.current) {
        clearTimeout(startupTimerRef.current);
        startupTimerRef.current = null;
      }
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
      onUnregisterCommand?.(sessionId);
      ptyRef.current?.kill();
      terminalRef.current?.dispose();
      ptyRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [cwd, sessionId, updateStatus, useTmux, tmuxSessionName, onRegisterCommand, onUnregisterCommand, tmuxHistoryLimit]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const theme = getTerminalTheme(themeMode);
    const maybeSetOption = (terminal as unknown as { setOption?: (key: string, value: unknown) => void })
      .setOption;
    if (typeof maybeSetOption === "function") {
      maybeSetOption("theme", theme);
    } else {
      terminal.options.theme = theme;
    }
    if (terminal.rows > 0) {
      terminal.refresh(0, terminal.rows - 1);
    }
  }, [themeMode, sessionId]);

  if (error) {
    return (
      <TerminalPresentational>
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
      </TerminalPresentational>
    );
  }

  return (
    <TerminalPresentational>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden p-2 bg-main"
        onMouseDown={() => {
          terminalRef.current?.focus();
        }}
      />
    </TerminalPresentational>
  );
}

export default Terminal;
