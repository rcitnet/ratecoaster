export interface CollectArgs {
  dryRun: boolean;
  list: boolean;
  only: string | null;
  propertySlug: string | null;
}

function optionValue(args: string[], option: string): string | null {
  const index = args.indexOf(option);
  if (index < 0) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseCollectArgs(args: string[]): CollectArgs {
  const only = optionValue(args, "--only");
  const propertySlug = optionValue(args, "--property");

  if (propertySlug && only !== "hotel-rates") {
    throw new Error("--property can only be used with --only hotel-rates");
  }
  if (propertySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(propertySlug)) {
    throw new Error(`invalid property slug: ${propertySlug}`);
  }

  return {
    dryRun: args.includes("--dry-run"),
    list: args.includes("--list"),
    only,
    propertySlug,
  };
}
