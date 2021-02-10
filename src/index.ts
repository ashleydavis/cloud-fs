import { AzureFileSystem } from "./plugins/azure";
import { IFileSystem, IFsNode } from "./plugins/file-system";
import { LocalFileSystem } from "./plugins/local";
import * as path from "path";
import { AWSFileSystem } from "./plugins/aws";

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
    aws: new AWSFileSystem(),
};

//
// Normalizes a path.
//
function normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
}

//
// Joins paths.
//
function joinPath(...args: string[]): string {
    return normalizePath(path.join(...args));
}

export class CloudFS {

    //
    // The current working directory.
    //
    private workingDir: string = "/";
    
    //
    // Parses a path and extract the file system ID.
    //
    private parsePath(path: string): IParsedPath {
        if (path[0] === "/") {
            path = path.substring(1);
        }
        const sepIndex = path.indexOf("/");
        if (sepIndex === -1) {
            throw new Error(`Expected a slash separator.`);
        }
    
        return {
            fileSystem: path.substring(0, sepIndex), 
            path: path.substring(sepIndex+1) || "/"
        };
    }

    //
    // Get the full path based on the current directory.
    //
    private getFullDir(path?: string): string {
        if (path === undefined || path.length === 0) {
            return this.workingDir;
        }

        if (path[0] === "/") {
            // Absolute path.
            return path;
        }
        else {
            return joinPath(this.workingDir, path);
        }
    }

    /**
     * Gets the current working directory.
     */
    pwd(): string {
        return this.workingDir;
    }

    /**
     * Changes the current working directory.
     * 
     * @param dir The directory to change to.
     */
    cd(dir: string): void {
        if (dir.length === 0) {
            return; // No change.
        }

        dir = normalizePath(dir);

        if (dir[0] === "/") {
            // Absolute path.
            this.workingDir = dir;
        }
        else {
            this.workingDir = joinPath(this.workingDir, dir);
        }
    }
    
    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir?: string): AsyncIterable<IFsNode> {
        dir = this.getFullDir(dir);
            if (dir === "/") {
            yield* [
                {
                    isDir: true,
                    name: "az",
                },
                {
                    isDir: true,
                    name: "aws",
                },
                {
                    isDir: true,
                    name: "local",
                },
            ];
            return;
        }

        const path = this.parsePath(dir);
        const fs = fileSystems[path.fileSystem];
        yield* fs.ls(path.path);
    }

    //
    // Copies a single file.
    //
    private async copyFile(srcFs: IFileSystem, srcFilePath: string, destFs: IFileSystem, destFilePath: string): Promise<void> {
        const destExists = await destFs.exists(destFilePath);
        if (destExists) {
            console.log(`Dest file already exists.`);
            return;
        }

        const input = await srcFs.createReadStream(srcFilePath);
        await destFs.copyStreamTo(destFilePath, input);
    }

    //
    // Copies a directory recursively.
    //
    private async copyDir(srcFs: IFileSystem, srcFsId: string, srcPath: string, destFs: IFileSystem, destFsId: string, destPath: string): Promise<void> {
        const nodes = srcFs.ls(srcPath);
        for await (const node of nodes) {
            if (node.isDir) {
                await this.copyDir(srcFs, srcFsId, joinPath(srcPath, node.name), destFs, destFsId, joinPath(destPath, node.name));
            }
            else {
                const srcFilePath = joinPath(srcPath, node.name);
                const fileBasename = node.name;
    
                await destFs.ensureDir(destPath);
    
                const destFilePath = joinPath(destPath, fileBasename);
                console.log(`cp ${srcFsId}:${srcFilePath} => ${destFsId}:${destFilePath}`);
    
                await this.copyFile(srcFs, srcFilePath, destFs, destFilePath);
            }
        }
    }

    /**
     * Copies files and directories from one place to another (including from one cloud vendor to another).
     * 
     * @param src The source file or directory to copy.
     * @param dest The destination directory to copy to.
     */
    async cp(src: string, dest: string): Promise<void> {
        const srcPath = this.parsePath(this.getFullDir(src));
        const destPath = this.parsePath(this.getFullDir(dest));
        const srcFs = fileSystems[srcPath.fileSystem];
        const destFs = fileSystems[destPath.fileSystem];
        const isSrcDirectory = srcPath.path[srcPath.path.length-1] === "/";
        if (isSrcDirectory) {
            await this.copyDir(srcFs, srcPath.fileSystem, srcPath.path, destFs, destPath.fileSystem, destPath.path);
        }
        else {
            const fileBasename = path.basename(srcPath.path);
    
            await destFs.ensureDir(destPath.path);
    
            const destFilePath = joinPath(destPath.path, fileBasename);
            console.log(`"cp ${srcPath.fileSystem}:${srcPath.path} => ${destPath.fileSystem}:${destFilePath}"`);
    
            await this.copyFile(srcFs, srcPath.path, destFs, destFilePath);            
        }
     }
}
