/**
 * Format a set of CLI options into a string where {key}={value}.
 */
export function toCLIArgs(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

/**
 * Parse a CLI options string into a key-value pair record.
 */
export function parseCLIArgs(optionsString: string): Record<string, string> {
  const optionsArray = optionsString.split(" ");
  const optionsRecord: Record<string, string> = {};

  optionsArray.forEach((option) => {
    const [key, value] = option.split("=");
    if (key && value) {
      optionsRecord[key] = value;
    }
  });

  return optionsRecord;
}

export function mergeSparkExtraJars(
  ...args: (string | Record<string, string> | undefined)[]
): string {
  return toCLIArgs(
    args.reduce((acc: Record<string, string>, current) => {
      if (typeof current === "string") {
        current = parseCLIArgs(current);
      } else if (current === undefined) {
        current = {};
      }
      return { ...acc, ...current };
    }, {}),
  );
}
