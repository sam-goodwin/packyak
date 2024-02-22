export interface PythonPoetryArgs {
  readonly include: string[] | undefined;
  readonly exclude: string[] | undefined;
  readonly dev: boolean | undefined;
  readonly allExtras: boolean | undefined;
  readonly withoutHashes: boolean | undefined;
  readonly withoutUrls: boolean | undefined;
}
