export type MigrationPhase = "all" | "production-baseline" | "production-upgrade";

export function compareMigrationFilenames(a: string, b: string): number {
  const classify = (filename: string): [number, number, string] => {
    const dated = filename.match(/^(\d{8})_/);
    if (dated) {
      const date = Number(dated[1]);
      if (date >= 20261018 && date <= 20261021) return [1, date, filename];
      if (date >= 20261022) return [3, date, filename];
      return [1, date, filename];
    }

    const numeric = filename.match(/^(\d+)_/);
    if (numeric) {
      const version = Number(numeric[1]);
      if (version === 96) return [2, 0, filename];
      if (version < 96) return [0, version, filename];
      return [4, version, filename];
    }

    return [5, 0, filename];
  };

  const left = classify(a);
  const right = classify(b);
  return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]);
}

export function selectMigrationFilenames(files: string[], phase: MigrationPhase): string[] {
  if (phase === "all") return [...files].sort(compareMigrationFilenames);
  if (phase !== "production-baseline" && phase !== "production-upgrade") {
    throw new Error("Unsupported migration phase: " + phase);
  }

  return files
    .filter((filename) => {
      const version = filename.split("_", 1)[0]!;
      if (phase === "production-baseline") {
        if (/^\d{8}$/.test(version)) return Number(version) <= 20261021;
        if (/^\d+$/.test(version)) return Number(version) <= 87 || version === "096";
        return false;
      }
      return /^\d{8}$/.test(version) && Number(version) >= 20261022;
    })
    .sort(compareMigrationFilenames);
}
