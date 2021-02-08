/*
Interface to the local file system.
*/

import { IFileSystem } from "./file-system";
import * as shell from "shelljs";

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
}
