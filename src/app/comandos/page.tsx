import CommandTerminal from "@/components/commands/CommandTerminal";
import ServerSelector from "@/components/commands/ServerSelector";
import CommandHistory from "@/components/commands/CommandHistory";

export default function CommandsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ejecución de comandos</h1>

        <p className="text-[var(--text-secondary)] mt-1">
          Ejecuta comandos remotos sobre EC2 y ECS.
        </p>
      </div>

      <ServerSelector />

      <CommandTerminal />

      <CommandHistory />
    </div>
  );
}
