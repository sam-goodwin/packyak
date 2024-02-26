/**
 * A statically defined POSIX Group.
 */
export interface PosixGroup {
  /**
   * Unique name of the POSIX group.
   */
  readonly name: string;
  /**
   * Unique ID of the POSIX group.
   */
  readonly gid: number;
}
