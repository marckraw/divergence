import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import {
  Button,
  DEFAULT_TMUX_HISTORY_LIMIT,
  recordDebugEvent,
  useAppSettings,
} from "../../../shared";
import "@xterm/xterm/css/xterm.css";
import { relaunchApp } from "../../../shared/api/updater.api";
import { getTmuxDiagnostics } from "../../../shared/api/tmuxSessions.api";
import {
  type PtyProcess,
  spawnInteractiveShellPty,
  spawnTmuxPty,
} from "../../../shared/api/pty.api";
import {
  buildTmuxBootstrapCommand,
  sanitizeTmuxSessionNameForShell,
  SHELL_BOOTSTRAP_TIMEOUT_MS,
  TMUX_BOOTSTRAP_TIMEOUT_MS,
  buildBootstrapTimeoutMessage,
} from "../lib/terminalTmux.pure";
import {
  shouldAutoReconnect,
  getReconnectDelayMs,
} from "../lib/terminalReconnect.pure";
import { getTerminalTheme } from "../lib/terminalTheme.pure";
import TerminalPresentational from "./Terminal.presentational";

const SPAWN_DEBOUNCE_MS = 50;

interface TerminalProps {
  cwd: string;
  sessionId: string;
  useTmux?: boolean;
  tmuxSessionName?: string;
  tmuxHistoryLimit?: number;
  portEnv?: Record<string, string>;
  isFocused?: boolean;
  onRegisterCommand?: (sessionId: string, sendCommand: (command: string) => void) => void;
  onUnregisterCommand?: (sessionId: string) => void;
  onStatusChange?: (status: "idle" | "active" | "busy") => void;
  onReconnect?: () => void;
  onClose?: () => void;
}

interface StartupIssueState {
  message: string;
  details: string;
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

function getMemorySnapshotMetadata(): Record<string, number> | undefined {
  const memory = (performance as PerformanceWithMemory).memory;
  if (!memory) {
    return undefined;
  }
  return {
    jsHeapUsedMb: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
    jsHeapTotalMb: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
    jsHeapLimitMb: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)),
  };
}

function Terminal({
  cwd,
  sessionId,
  useTmux = false,
  tmuxSessionName,
  tmuxHistoryLimit,
  portEnv,
  isFocused,
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
  const [startupIssue, setStartupIssue] = useState<StartupIssueState | null>(null);
  const [isRestartingApp, setIsRestartingApp] = useState(false);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const onStatusChangeRef = useRef<TerminalProps["onStatusChange"]>(onStatusChange);
  const onReconnectRef = useRef(onReconnect);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedDataRef = useRef(false);
  const hasLoggedFirstOutputRef = useRef(false);
  const spawnStartedAtRef = useRef<number | null>(null);
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

  const logTerminalDebugEvent = useCallback((
    level: "info" | "warn" | "error",
    message: string,
    details?: string,
    metadata?: Record<string, string | number | boolean | null>
  ) => {
    recordDebugEvent({
      level,
      category: "terminal",
      message,
      details,
      metadata: {
        sessionId,
        mode: useTmux ? "tmux" : "shell",
        ...metadata,
      },
    });
  }, [sessionId, useTmux]);

  const handleReconnectNow = useCallback(() => {
    setStartupIssue(null);
    logTerminalDebugEvent("info", "Manual reconnect requested from startup banner");
    onReconnectRef.current?.();
  }, [logTerminalDebugEvent]);

  const handleRestartApp = useCallback(async () => {
    setIsRestartingApp(true);
    try {
      await relaunchApp();
    } catch (relaunchError) {
      const message = relaunchError instanceof Error
        ? relaunchError.message
        : String(relaunchError);
      logTerminalDebugEvent("error", "Failed to restart app from terminal banner", message);
      setStartupIssue((current) => {
        if (!current) {
          return {
            message: "Failed to restart the app from this screen.",
            details: `Error: ${message}`,
          };
        }
        return {
          ...current,
          details: `${current.details} • Restart failed: ${message}`,
        };
      });
    } finally {
      setIsRestartingApp(false);
    }
  }, [logTerminalDebugEvent]);

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
      logTerminalDebugEvent("info", "Initializing terminal", undefined, {
        cwd,
        tmuxSessionName: tmuxSessionName ?? null,
      });

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
            ...portEnv,
          },
        });

        const safeSessionName = sanitizeTmuxSessionNameForShell(tmuxSessionName, sessionId);
        const tmuxCommand = buildTmuxBootstrapCommand();

        try {
          setStartupIssue(null);
          setIsRestartingApp(false);
          spawnStartedAtRef.current = Date.now();
          hasLoggedFirstOutputRef.current = false;
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
                  ...portEnv,
                },
              })
            : spawnShell();

          ptyRef.current = pty;
          hasReceivedDataRef.current = false;
          console.log(`[${sessionId}] PTY spawned`);
          logTerminalDebugEvent("info", "PTY spawned", undefined, {
            cwd,
            tmuxSessionName: safeSessionName,
            startupTimeoutMs: useTmux ? TMUX_BOOTSTRAP_TIMEOUT_MS : SHELL_BOOTSTRAP_TIMEOUT_MS,
          });
          terminal.write("\r\x1b[2K");

          const startupTimeoutMs = useTmux
            ? TMUX_BOOTSTRAP_TIMEOUT_MS
            : SHELL_BOOTSTRAP_TIMEOUT_MS;
          if (startupTimerRef.current) {
            clearTimeout(startupTimerRef.current);
          }
          startupTimerRef.current = setTimeout(() => {
            startupTimerRef.current = null;
            if (isDisposedRef.current || hasReceivedDataRef.current) {
              return;
            }

            const stallMessage = useTmux
              ? buildBootstrapTimeoutMessage(startupTimeoutMs)
              : `[shell did not respond within ${Math.round(startupTimeoutMs / 1000)}s. Terminal startup may be stalled.]`;
            const elapsedMs = spawnStartedAtRef.current
              ? Date.now() - spawnStartedAtRef.current
              : startupTimeoutMs;
            const memorySnapshot = getMemorySnapshotMetadata();
            console.warn(`[${sessionId}] terminal startup stalled (${startupTimeoutMs}ms)`);
            logTerminalDebugEvent(
              "warn",
              "Terminal startup stalled",
              stallMessage,
              {
                cwd,
                tmuxSessionName: safeSessionName,
                startupTimeoutMs,
                elapsedMs,
                ...(memorySnapshot ?? {}),
              }
            );
            terminal.write(`\r\n\x1b[33m${stallMessage}\x1b[0m\r\n`);
            setStartupIssue({
              message: "Terminal startup is taking longer than expected.",
              details: `session=${sessionId} • mode=${useTmux ? "tmux" : "shell"} • cwd=${cwd} • elapsed=${Math.round(elapsedMs / 1000)}s`,
            });
            updateStatus("idle");

            if (useTmux) {
              void getTmuxDiagnostics()
                .then((diag) => {
                  const tmuxVersion = diag.version.stdout.trim() || diag.version.error || "unknown";
                  const listSessionsErr = diag.list_sessions_raw.stderr.trim()
                    || diag.list_sessions_raw.error
                    || "none";
                  const tmpdirMismatch = Boolean(
                    diag.env_tmpdir
                    && diag.login_shell_tmpdir
                    && diag.env_tmpdir !== diag.login_shell_tmpdir
                  );
                  recordDebugEvent({
                    level: tmpdirMismatch ? "error" : "warn",
                    category: "tmux",
                    message: tmpdirMismatch
                      ? "TMPDIR mismatch detected during terminal stall"
                      : "Tmux diagnostics captured after terminal stall",
                    details: [
                      `tmux_path=${diag.resolved_tmux_path ?? "NOT FOUND"}`,
                      `login_shell_tmux_path=${diag.login_shell_tmux_path ?? "unresolved"}`,
                      `tmux_version=${tmuxVersion}`,
                      `list_sessions_exit=${diag.list_sessions_raw.status_code ?? "N/A"}`,
                      `list_sessions_stderr=${listSessionsErr}`,
                      `env_tmpdir=${diag.env_tmpdir ?? "UNSET"}`,
                      `login_tmpdir=${diag.login_shell_tmpdir ?? "UNSET"}`,
                    ].join("\n"),
                    metadata: {
                      sessionId,
                      tmuxSessionName: safeSessionName,
                      tmpdirMismatch,
                    },
                  });
                })
                .catch((diagnosticsError: unknown) => {
                  const message = diagnosticsError instanceof Error
                    ? diagnosticsError.message
                    : String(diagnosticsError);
                  recordDebugEvent({
                    level: "error",
                    category: "tmux",
                    message: "Failed to capture tmux diagnostics during terminal stall",
                    details: message,
                    metadata: {
                      sessionId,
                      tmuxSessionName: safeSessionName,
                    },
                  });
                });
            }
          }, startupTimeoutMs);

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
              setStartupIssue(null);
              if (!hasLoggedFirstOutputRef.current) {
                hasLoggedFirstOutputRef.current = true;
                const firstOutputLatencyMs = spawnStartedAtRef.current
                  ? Date.now() - spawnStartedAtRef.current
                  : 0;
                logTerminalDebugEvent("info", "Received first terminal output", undefined, {
                  firstOutputLatencyMs,
                  tmuxSessionName: safeSessionName,
                });
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
            if (startupTimerRef.current) {
              clearTimeout(startupTimerRef.current);
              startupTimerRef.current = null;
            }
            console.log(`[${sessionId}] PTY exited: ${exitCode}`);
            logTerminalDebugEvent(exitCode === 0 ? "info" : "warn", "PTY exited", undefined, {
              exitCode,
              tmuxSessionName: safeSessionName,
            });
            terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
            updateStatus("idle");

            const attempt = reconnectAttemptRef.current;
            if (shouldAutoReconnect(exitCode, useTmux, attempt)) {
              const delayMs = getReconnectDelayMs(attempt);
              const delaySec = Math.round(delayMs / 1000);
              logTerminalDebugEvent("warn", "Scheduling terminal auto-reconnect", undefined, {
                exitCode,
                attempt: attempt + 1,
                delayMs,
              });
              terminal.write(`\x1b[33m[Reconnecting in ${delaySec}s... (attempt ${attempt + 1})]\x1b[0m\r\n`);
              reconnectAttemptRef.current = attempt + 1;
              reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null;
                if (!isDisposedRef.current) {
                  onReconnectRef.current?.();
                }
              }, delayMs);
            } else if (exitCode !== 0) {
              logTerminalDebugEvent("warn", "Auto-reconnect limit reached", undefined, {
                exitCode,
                attempts: attempt,
              });
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
          logTerminalDebugEvent("error", "PTY startup failed", errorMessage, {
            cwd,
            tmuxSessionName: safeSessionName,
          });
          setError(errorMessage);
          terminal.write(`\r\n\x1b[31mFailed to start terminal: ${errorMessage}\x1b[0m\r\n`);
        }
      }, SPAWN_DEBOUNCE_MS);
    };

    initTerminal();

    return () => {
      console.log(`[${sessionId}] Cleanup`);
      logTerminalDebugEvent("info", "Terminal cleanup");
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
      spawnStartedAtRef.current = null;
      hasLoggedFirstOutputRef.current = false;
      ptyRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [
    cwd,
    sessionId,
    updateStatus,
    useTmux,
    tmuxSessionName,
    portEnv,
    onRegisterCommand,
    onUnregisterCommand,
    tmuxHistoryLimit,
    logTerminalDebugEvent,
  ]);

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

  useEffect(() => {
    if (isFocused) {
      terminalRef.current?.focus();
    }
  }, [isFocused]);

  if (error) {
    return (
      <TerminalPresentational>
        <div className="absolute inset-0 flex items-center justify-center bg-main text-red">
          <div className="text-center">
            <p className="text-lg mb-2">Terminal Error</p>
            <p className="text-sm text-subtext">{error}</p>
            <Button
              onClick={onClose}
              variant="secondary"
              size="md"
              className="mt-4 px-4 py-2 bg-surface rounded hover:bg-surface/80 text-text"
            >
              Close
            </Button>
          </div>
        </div>
      </TerminalPresentational>
    );
  }

  return (
    <TerminalPresentational>
      {startupIssue && (
        <div className="absolute left-3 right-3 top-3 z-20 rounded border border-yellow/40 bg-main/95 p-3 shadow-lg">
          <p className="text-xs font-medium text-yellow">
            {startupIssue.message}
          </p>
          <p className="mt-1 text-[11px] text-subtext break-all">
            {startupIssue.details}
          </p>
          <p className="mt-1 text-[11px] text-subtext">
            Reconnect this terminal first. If all terminals are stuck, restart the app.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              onClick={handleReconnectNow}
              disabled={!onReconnect}
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-xs rounded border border-surface text-text hover:bg-surface disabled:opacity-40"
            >
              Reconnect terminal
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleRestartApp();
              }}
              disabled={isRestartingApp}
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-xs rounded bg-yellow/20 text-yellow hover:bg-yellow/30 disabled:opacity-40"
            >
              {isRestartingApp ? "Restarting..." : "Restart app"}
            </Button>
          </div>
        </div>
      )}
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
