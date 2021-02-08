
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

    /**
     * Ensure that the requested directory exists, creates it if it doesn't exist.
     * 
     * @param dir The directory to create.
     */
    ensureDir(dir: string): Promise<void>;

    /**
     * Returns true if the specified file already exists in the file system.
     * 
     * @param file The file to check for existance.
     */
    exists(file: string): Promise<boolean>;

    /**
     * Creates a readable stream for a file.
     * 
     * @param file The file to open.
     */
    createReadStream(file: string): Promise<NodeJS.ReadableStream>;

    /**
     * Creates a writable stream for a file.
     * 
     * @param file The file to open.
     */
    createWriteStream(file: string): Promise<NodeJS.WritableStream>;
}
