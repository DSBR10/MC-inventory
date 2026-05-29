"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

type Props = {
  instanceId: string;
  accountId: string;
};

type CommandResult = {
  output?: string;
  error?: string;
};

export default function EC2Terminal({ instanceId, accountId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const commandRef = useRef("");
  const [, setCurrentCommand] = useState("");

  const executeCommand = useCallback(
    async (cmd: string) => {
      if (!term.current) return;

      const trimmed = cmd.trim();

      if (!trimmed) {
        term.current.write("$ ");
        return;
      }

      term.current.write("\r\nRunning...\r\n");

      try {
        const res = await fetch("/api/ec2/run-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ instanceId, accountId }],
            command: trimmed,
          }),
        });

        if (res.status === 403) {
          term.current.write(
            "\x1b[33mEl comando que esta intentando ejecutar no esta permitido.\x1b[0m\r\n",
          );
          term.current.write("$ ");
          return;
        }

        if (!res.ok) {
          term.current.write(`\x1b[31mError del servidor (${res.status})\x1b[0m\r\n`);
          term.current.write("$ ");
          return;
        }

        const result = (await res.json()) as CommandResult[];
        const first = result[0];

        if (!first) {
          term.current.write("\x1b[31mSin respuesta del servidor\x1b[0m\r\n");
          term.current.write("$ ");
          return;
        }

        if (first.output) {
          term.current.write(first.output.replace(/\n/g, "\r\n") + "\r\n");
        } else if (first.error) {
          term.current.write(`\x1b[31m${first.error}\x1b[0m\r\n`);
        } else {
          term.current.write("(sin salida)\r\n");
        }
      } catch {
        term.current.write("\x1b[31mNo se pudo conectar con el servidor\x1b[0m\r\n");
      }

      term.current.write("$ ");
    },
    [accountId, instanceId],
  );

  const handleInput = useCallback(
    (data: string) => {
      if (!term.current) return;

      if (data === "\r") {
        executeCommand(commandRef.current);
        commandRef.current = "";
        setCurrentCommand("");
        term.current.write("\r\n");
        return;
      }

      if (data === "\u007F") {
        commandRef.current = commandRef.current.slice(0, -1);
        setCurrentCommand(commandRef.current);
        term.current.write("\b \b");
        return;
      }

      commandRef.current += data;
      setCurrentCommand(commandRef.current);
      term.current.write(data);
    },
    [executeCommand],
  );

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: "#000000",
      },
    });

    term.current = terminal;
    terminal.open(terminalRef.current);
    terminal.write("MC Inventory Terminal\r\n");
    terminal.write(`Instance: ${instanceId}\r\n\r\n`);
    terminal.write("$ ");

    const disposable = terminal.onData(handleInput);

    return () => {
      disposable.dispose();
      terminal.dispose();
      term.current = null;
    };
  }, [handleInput, instanceId]);

  return (
    <div className="bg-black p-4 rounded-xl">
      <div ref={terminalRef} style={{ height: "400px" }} />
    </div>
  );
}
