import { useRef, useCallback, useEffect, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { IPty } from "tauri-pty";
import { spawnLoginPty } from "../api/pty.api";

type TerminalStatus = "idle" | "active" | "busy";

interface UseTerminalOptions {
  cwd?: string;
  onStatusChange?: (status: TerminalStatus) => void;
  onData?: (data: string) => void;
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
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
