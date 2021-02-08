import * as Vorpal from "vorpal";
import { AzureFileSystem } from "./plugins/azure";
import { IFileSystem } from "./plugins/file-system";
import { LocalFileSystem } from "./plugins/local";

//
// Parses a path and extract the file system ID.
//
interface IParsedPath {
    fileSystem: string;
    path: string;
}

//
// Lookup table for file systems.
//
const fileSystems: { [name: string]: IFileSystem } = {
    local: new LocalFileSystem(),
    az: new AzureFileSystem(),
};

export class CloudFS {

    //
    // Parses a path and extract the file system ID.
    //
    private parsePath(path: string): IParsedPath {
        const sepIndex = path.indexOf(":");
        if (sepIndex === -1) {
            return { 
                fileSystem: "local", 
                path: path
            };
        }
    
        return {
            fileSystem: path.substring(0, sepIndex), 
            path: path.substring(sepIndex+1) || "."
        };
    }
    
    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir: string): AsyncIterable<string> {
        const path = this.parsePath(dir);
        const fs = fileSystems[path.fileSystem];
        yield* fs.ls(path.path);
    }
}
