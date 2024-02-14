export class Version {
  constructor(readonly version: string) {}

  public get majorMinorVersion(): string {
    return this.version.split(".").slice(0, 2).join(".");
  }
}
