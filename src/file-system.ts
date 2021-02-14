import { Readable } from "stream";

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

    /**
     * Type of content within the file.
     */
    contentType?: string;

    /**
     * Size of the file.
     */
    contentLength?: number;
}

export interface IFileReadResponse {
    /**
     * Type of content within the file.
     */
    contentType?: string;

    /**
     * Size of the file.
     */
    contentLength?: number;

    /**
     * Readable stream for the file.
     */
    stream: Readable;
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
    createReadStream(file: string): Promise<IFileReadResponse>;

    /**
     * Writes an input stream to a file.
     * 
     * @param file The file to write to.
     */
    copyStreamTo(file: string, input: IFileReadResponse): Promise<void>;
}
