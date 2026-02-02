import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn, type IPty } from "tauri-pty";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  cwd: string;
  sessionId: string;
  onStatusChange?: (status: "idle" | "active" | "busy") => void;
  onClose?: () => void;
}

function Terminal({ cwd, sessionId, onStatusChange, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  const updateStatus = useCallback((status: "idle" | "active" | "busy") => {
    onStatusChange?.(status);
  }, [onStatusChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initializedRef.current) return;

    // Wait for container to have dimensions
    const initTerminal = async () => {
      // Ensure container has dimensions
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Retry after a short delay
        setTimeout(initTerminal, 100);
        return;
      }

      initializedRef.current = true;

      // Create terminal instance
      const terminal = new XTerm({
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
        allowTransparency: false,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Open terminal in container
      terminal.open(container);

      // Fit after opening
      setTimeout(() => {
        fitAddon.fit();
        initPty(terminal);
      }, 50);

      async function initPty(term: XTerm) {
        try {
          const cols = term.cols || 80;
          const rows = term.rows || 24;

          console.log(`[${sessionId}] Spawning PTY with cols=${cols}, rows=${rows}, cwd=${cwd}`);

          const pty = spawn("/bin/zsh", ["-l"], {
            cols,
            rows,
            cwd,
            env: {
              TERM: "xterm-256color",
              COLORTERM: "truecolor",
            },
          });

          ptyRef.current = pty;

          // Handle PTY output
          pty.onData((data: Uint8Array) => {
            const text = new TextDecoder().decode(data);
            term.write(text);
            updateStatus("active");
            if (activityTimeoutRef.current) {
              clearTimeout(activityTimeoutRef.current);
            }
            activityTimeoutRef.current = setTimeout(() => {
              updateStatus("idle");
            }, 2000);
          });

          pty.onExit(() => {
            term.write("\r\n\x1b[90m[Terminal session ended]\x1b[0m\r\n");
            updateStatus("idle");
          });

          // Handle terminal input
          term.onData((data: string) => {
            pty.write(data);
          });

          term.focus();
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[${sessionId}] PTY spawn error:`, err);
          setError(errorMessage);
          term.write(`\r\n\x1b[31mFailed to start terminal: ${errorMessage}\x1b[0m\r\n`);
        }
      }

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current && terminalRef.current && ptyRef.current) {
          fitAddonRef.current.fit();
          ptyRef.current.resize(terminalRef.current.cols, terminalRef.current.rows);
        }
      });
      resizeObserver.observe(container);

      // Cleanup function stored for later
      return () => {
        resizeObserver.disconnect();
      };
    };

    initTerminal();

    // Cleanup
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      ptyRef.current?.kill();
      terminalRef.current?.dispose();
    };
  }, [cwd, sessionId, updateStatus]);

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
      className="absolute inset-0 overflow-hidden p-1"
    />
  );
}

export default Terminal;
