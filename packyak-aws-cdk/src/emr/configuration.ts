export interface Configuration {
  classification: string;
  configurationProperties: { [key: string]: string };
}
// TODO: if keys like `"spark.jars.packages"` collide, join by , and dedupe
export function combineConfigurations(
  ...configs: Configuration[]
): Configuration[] {
  const mergedConfigurations = configs.reduce(
    (acc: { [classification: string]: Configuration }, curr: Configuration) => {
      const { classification, configurationProperties } = curr;
      if (!acc[classification]) {
        acc[classification] = { classification, configurationProperties: {} };
      }
      acc[classification].configurationProperties = {
        ...acc[classification].configurationProperties,
        ...configurationProperties,
      };
      return acc;
    },
    {},
  );
  return Object.values(mergedConfigurations);
}
