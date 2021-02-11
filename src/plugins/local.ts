/*
Interface to the local file system.
*/

import { IFileReadResponse, IFileSystem, IFsNode } from "./file-system";
import * as shell from "shelljs";
import { createReadStream, createWriteStream } from "fs";
import * as fsExtra from "fs-extra";
import * as path from "path";
import { waitPipe } from "../utils";

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
    async createReadStream(file: string): Promise<IFileReadResponse> {
        return {
            //todo: use file ext for content type.
            //todo: use stat for file lenght
            stream: createReadStream(file),
        };
    }

    /**
     * Writes an input stream to a file.
     * 
     * @param file The file to write to.
     */
    async copyStreamTo(file: string, input: IFileReadResponse): Promise<void> {
        await fsExtra.ensureDir(path.dirname(file));
        await waitPipe(
            input.stream,
            createWriteStream(file)
        );
    }
}
