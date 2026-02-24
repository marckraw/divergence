import { useRef, useCallback, useEffect, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawnLoginPty, type PtyProcess } from "../api/pty.api";

type TerminalStatus = "idle" | "active" | "busy";

interface UseTerminalOptions {
  cwd?: string;
  onStatusChange?: (status: TerminalStatus) => void;
  onData?: (data: string) => void;
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<PtyProcess | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStatus = useCallback((newStatus: TerminalStatus) => {
    setStatus(newStatus);
    options.onStatusChange?.(newStatus);
  }, [options]);

  const initialize = useCallback(async (container: HTMLDivElement) => {
    if (isInitialized || !container) return;

    containerRef.current = container;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#09090b",
        foreground: "#fafafa",
        cursor: "#fafafa",
        cursorAccent: "#09090b",
        selectionBackground: "#3f3f4666",
        black: "#27272a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#d4d4d8",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#a1a1aa",
      },
      allowTransparency: false,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.open(container);
    fitAddon.fit();

    // Spawn PTY process
    const cols = terminal.cols;
    const rows = terminal.rows;

    try {
      const pty = spawnLoginPty({
        cols,
        rows,
        cwd: options.cwd || "/",
        env: {
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
        },
      });

      ptyRef.current = pty;

      // Handle PTY output - data comes as Uint8Array
      pty.onData((data: Uint8Array) => {
        const text = new TextDecoder().decode(data);
        terminal.write(text);
        options.onData?.(text);

        // Update activity status
        updateStatus("active");
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current);
        }
        activityTimeoutRef.current = setTimeout(() => {
          updateStatus("idle");
        }, 2000);
      });

      pty.onExit(() => {
        terminal.write("\r\n[Process exited]\r\n");
        updateStatus("idle");
      });

      // Handle terminal input
      terminal.onData((data: string) => {
        pty.write(data);
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit();
          const { cols: newCols, rows: newRows } = terminalRef.current;
          ptyRef.current?.resize(newCols, newRows);
        }
      });

      resizeObserver.observe(container);

      setIsInitialized(true);

      return () => {
        resizeObserver.disconnect();
        pty.kill();
        terminal.dispose();
      };
    } catch (err) {
      console.error("Failed to spawn PTY:", err);
      terminal.write(`\r\nFailed to spawn terminal: ${err}\r\n`);
    }
  }, [isInitialized, options, updateStatus]);

  const write = useCallback((data: string) => {
    ptyRef.current?.write(data);
  }, []);

  const sendCommand = useCallback((command: string) => {
    ptyRef.current?.write(command + "\n");
    updateStatus("busy");
  }, [updateStatus]);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
    if (terminalRef.current && ptyRef.current) {
      const { cols, rows } = terminalRef.current;
      ptyRef.current.resize(cols, rows);
    }
  }, []);

  const kill = useCallback(() => {
    ptyRef.current?.kill();
  }, []);

  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      ptyRef.current?.kill();
      terminalRef.current?.dispose();
    };
  }, []);

  return {
    initialize,
    write,
    sendCommand,
    focus,
    fit,
    kill,
    isInitialized,
    status,
    terminalRef,
    containerRef,
  };
}
