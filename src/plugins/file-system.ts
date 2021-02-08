/**
 * Represents a file or directory in a file system.
 */
export interface IFsNode {

    /**
     * Set to true if a directory.
     */
    isDir: boolean;

    /**
     * Name of the file or directory.
     */
    name: string;
}

/**
 * Interface to a file system.
 */
export interface IFileSystem {
    
    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    ls(dir: string): AsyncIterable<IFsNode>;

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
     * Writes an input stream to a file.
     * 
     * @param file The file to write to.
     */
    copyStreamTo(file: string, input: NodeJS.ReadableStream): Promise<void>;
}
