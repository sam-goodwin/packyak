import { mergeSparkExtraJars } from "./spark-config";

export interface Configuration {
  readonly classification: string;
  readonly configurationProperties: Record<string, string>;
  readonly configurations?: Configuration[];
}
// TODO: if keys like `"spark.jars.packages"` collide, join by , and dedupe
export function combineConfigurations(
  ...configs: ((Configuration | undefined)[] | Configuration | undefined)[]
): Configuration[] | undefined {
  const mergedConfigurations =
    configs
      ?.flat()
      .reduce(
        (
          finalConfig: { [classification: string]: Configuration },
          next: Configuration | undefined,
        ) => {
          if (next === undefined) {
            return finalConfig;
          }
          const { classification, configurationProperties, configurations } =
            next;
          if (!finalConfig[classification]) {
            finalConfig[classification] = {
              classification,
              configurationProperties: {},
              configurations: undefined,
            };
          }

          // @ts-expect-error - slight hack to overwrite the readonly array. JSII requires readonly properties.
          finalConfig[classification].configurations = combineConfigurations(
            finalConfig[classification].configurations,
            configurations,
          );
          const csvProperties = new Set([
            "spark.jars.packages",
            "spark.sql.extensions",
          ]);
          for (const [key, value] of Object.entries(configurationProperties)) {
            if (csvProperties.has(key)) {
              const existing = finalConfig[classification]
                .configurationProperties[key]
                ? finalConfig[classification].configurationProperties[
                    key
                  ].split(",")
                : [];
              const newValues = value.split(",");
              const merged = [...new Set([...existing, ...newValues])].join(
                ",",
              );
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
      ) ?? [];
  const configurations = Object.values(mergedConfigurations);
  if (configurations.length == 0) {
    return undefined;
  }
  return configurations;
}
