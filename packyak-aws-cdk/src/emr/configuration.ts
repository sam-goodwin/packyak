export interface Configuration {
  classification: string;
  configurationProperties: { [key: string]: string };
}

export function combineConfigurations(...configs: Configuration[]): Configuration[] {
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
