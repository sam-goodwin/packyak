export class Version {
  constructor(readonly semverString: string) {}

  public get majorMinorVersion(): string {
    return this.semverString.split(".").slice(0, 2).join(".");
  }
}
