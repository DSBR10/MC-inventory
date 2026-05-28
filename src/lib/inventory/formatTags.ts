const TAG_ALIASES: Record<string, string[]> = {

  cliente: [
    "cliente",
    "client",
    "customer",
    "CLIENTE",
    "CLIENT",
    "Cliente",
    "Client"
  ],

  proyecto: [
    "proyecto",
    "project",
    "application",
    "app",
    "PROYECTO",
    "Proyecto",
    "Project"
  ]

};

export function formatTags(
  tags?: Record<string, string>
): string[] {

  if (
    !tags ||
    Object.keys(tags).length === 0
  ) {

    return ["Sin tags"];

  }

  const formatted: string[] = [];

  for (const [label, aliases] of Object.entries(TAG_ALIASES)) {

    for (const alias of aliases) {

      const value =
        tags[alias];

      if (
        value &&
        value.trim() !== ""
      ) {

        formatted.push(
          `${label}: ${value}`
        );

        break;

      }

    }

  }

  if (
    formatted.length > 0
  ) {

    return formatted;

  }

  // Si no hay tags de cliente o proyecto, devolver "Sin tags"
  return ["Sin tags"];

}