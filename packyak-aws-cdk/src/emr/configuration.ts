import { mergeSparkExtraJars } from "./spark-config";

export interface Configuration {
  readonly classification: string;
  readonly configurationProperties: Record<string, string>;
}
// TODO: if keys like `"spark.jars.packages"` collide, join by , and dedupe
export function combineConfigurations(
  ...configs: Configuration[]
): Configuration[] {
  const mergedConfigurations = configs.reduce(
    (
      finalConfig: { [classification: string]: Configuration },
      next: Configuration,
    ) => {
      const { classification, configurationProperties } = next;
      if (!finalConfig[classification]) {
        finalConfig[classification] = {
          classification,
          configurationProperties: {},
        };
      }
      const csvProperties = new Set([
        "spark.jars.packages",
        "spark.sql.extensions",
      ]);
      for (const [key, value] of Object.entries(configurationProperties)) {
        if (csvProperties.has(key)) {
          const existing = finalConfig[classification].configurationProperties[
            key
          ]
            ? finalConfig[classification].configurationProperties[key].split(
                ",",
              )
            : [];
          const newValues = value.split(",");
          const merged = [...new Set([...existing, ...newValues])].join(",");
          finalConfig[classification].configurationProperties[key] = merged;
        } else if (key == "spark.driver.extraJavaOptions") {
          finalConfig[classification].configurationProperties[key] =
            mergeSparkExtraJars(
              finalConfig[classification].configurationProperties[key],
              value,
            );
        } else {
          finalConfig[classification].configurationProperties[key] = value;
        }
      }

      return finalConfig;
    },
    {},
  );
  return Object.values(mergedConfigurations);
}
