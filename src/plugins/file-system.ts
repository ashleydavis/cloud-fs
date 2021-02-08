
/**
 * Interface to a file system.
 */
export interface IFileSystem {

    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    ls(dir: string): AsyncIterable<string>;
}
