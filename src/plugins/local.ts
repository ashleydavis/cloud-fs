/*
Interface to the local file system.
*/

import { IFileSystem } from "./file-system";
import * as shell from "shelljs";
import { createReadStream, createWriteStream } from "fs";
import * as fsExtra from "fs-extra";

export class LocalFileSystem implements IFileSystem {
    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir: string): AsyncIterable<string> {
        for (const item of shell.ls(dir)) {
            yield item;
        }
    }

    /**
     * Ensure that the requested directory exists, creates it if it doesn't exist.
     * 
     * @param dir The directory to create.
     */
    async ensureDir(dir: string): Promise<void> {
        await fsExtra.ensureDir(dir);
    }

    /**
     * Returns true if the specified file already exists in the file system.
     * 
     * @param file The file to check for existance.
     */
    async exists(file: string): Promise<boolean> {
        return await fsExtra.pathExists(file);
    }

    /**
     * Creates a readable stream for a file.
     * 
     * @param file The file to open.
     */
    async createReadStream(file: string): Promise<NodeJS.ReadableStream> {
        return createReadStream(file);
    }

    /**
     * Creates a writable stream for a file.
     * 
     * @param file The file to open.
     */
    async createWriteStream(file: string): Promise<NodeJS.WritableStream> {
        return createWriteStream(file);
    }

}
