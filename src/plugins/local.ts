/*
Interface to the local file system.
*/

import { IFileSystem, IFsNode } from "./file-system";
import * as shell from "shelljs";
import { createReadStream, createWriteStream } from "fs";
import * as fsExtra from "fs-extra";
import * as path from "path";

export class LocalFileSystem implements IFileSystem {
    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir: string): AsyncIterable<IFsNode> {
        for (const item of shell.ls(dir)) {
            const fullPath = path.join(dir, item);
            const stat = await fsExtra.stat(fullPath);
            yield {
                isDir: stat.isDirectory(),
                name: item,
            };
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
