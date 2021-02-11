import { AzureFileSystem } from "./plugins/azure";
import { IFileSystem, IFsNode } from "./plugins/file-system";
import { LocalFileSystem } from "./plugins/local";
import * as path from "path";
import { AWSFileSystem } from "./plugins/aws";
import ProgressBar = require("progress");

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
        if (path === undefined || path.length === 0) {
            throw new Error(`Empty path!`);
        }

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

    //
    // List files and directories recursively for a particular file system.
    // 
    private async* _ls(fs: IFileSystem, dir: string, recursive?: boolean): AsyncIterable<IFsNode> {
        for await (const node of fs.ls(dir)) {
            yield node;

            if (recursive && node.isDir) {
                const subPath = joinPath(dir, node.name);
                for await (const subNode of this._ls(fs, subPath, recursive)) {
                    yield {
                        isDir: subNode.isDir,
                        name: joinPath(node.name, subNode.name),
                    }   
                }
            }
        }
    }
    
    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     * @param recursive List files and directories for the entire subtree.
     */
    async* ls(dir?: string, recursive?: boolean): AsyncIterable<IFsNode> {
        dir = this.getFullDir(dir);
        if (dir === "/") {
            const rootDirs = ["az", "aws", "local"];
            for (const rootDir of rootDirs) {
                yield {
                    isDir: true,
                    name: rootDir,
                };
    
                if (recursive) {
                    const subPath = joinPath("/", rootDir);
                    for await (const node of this.ls(subPath, recursive)) {
                        yield {
                            isDir: node.isDir,
                            name: joinPath(subPath, node.name),
                        }
                    }
                }
            }

            return;
        }

        const path = this.parsePath(dir);
        const fs = fileSystems[path.fileSystem];
        if (!fs) {
            throw new Error(`Failed to find file system provider specified by "${path.fileSystem}".`);
        }
        yield* this._ls(fs, path.path, recursive);
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
        const nodes = this._ls(srcFs, srcPath, true);
        let fileCount = 0;
        for await (const node of nodes) {
            if (!node.isDir) {
                fileCount += 1;
            }
        }
        
        const bar = new ProgressBar("   Copying [:bar] :current/:total :percent", { 
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: fileCount,
        });

        const nodes2 = this._ls(srcFs, srcPath, true);
        for await (const node of nodes2) {
            if (node.isDir) {
                // Skip directories. 
                // The call to _ls already recurses.
                continue;
            }

            const srcFilePath = joinPath(srcPath, node.name);
            const fileBasename = node.name;

            await destFs.ensureDir(destPath);

            const destFilePath = joinPath(destPath, fileBasename);
            // console.log(`cp ${srcFsId}:${srcFilePath} => ${destFsId}:${destFilePath}`); //todo: move this into copyFile

            await this.copyFile(srcFs, srcFilePath, destFs, destFilePath);

            bar.tick();

            //TODO: update cur and total as new files are discovered.
            // bar.curr += 1;
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
        if (!srcFs) {
            throw new Error(`Failed to find file system provider with name "${srcPath.fileSystem}".`);
        }
        const destFs = fileSystems[destPath.fileSystem];
        if (!destFs) {
            throw new Error(`Failed to find file system provider with name "${destPath.fileSystem}".`);
        }
        const isSrcDirectory = srcPath.path[srcPath.path.length-1] === "/";
        if (isSrcDirectory) {
            await this.copyDir(srcFs, srcPath.fileSystem, srcPath.path, destFs, destPath.fileSystem, destPath.path);
        }
        else {
            const fileBasename = path.basename(srcPath.path);
    
            await destFs.ensureDir(destPath.path);
    
            const destFilePath = joinPath(destPath.path, fileBasename);
            console.log(`"cp ${srcPath.fileSystem}:${srcPath.path} => ${destPath.fileSystem}:${destFilePath}"`); //todo: move into copyFile.
    
            await this.copyFile(srcFs, srcPath.path, destFs, destFilePath);            
        }
     }
}
