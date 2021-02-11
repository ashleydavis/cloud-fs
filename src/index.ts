import { AzureFileSystem } from "./plugins/azure";
import { IFileSystem, IFsNode } from "./plugins/file-system";
import { LocalFileSystem } from "./plugins/local";
import * as path from "path";
import { AWSFileSystem } from "./plugins/aws";
import ProgressBar = require("progress");
import * as crypto from "crypto";

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

/**
 * Results of a file comparison.
 */
export interface IFsCompareItem {
    path: string;
    state: "different" | "source only" | "identical";
    reason?: string;
}

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
    private async* _ls(fs: IFileSystem, dir: string, options?: { recursive?: boolean }): AsyncIterable<IFsNode> {
        for await (const node of fs.ls(dir)) {
            yield node;

            if (options?.recursive && node.isDir) {
                const subPath = joinPath(dir, node.name);
                for await (const subNode of this._ls(fs, subPath, options)) {
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
    async* ls(dir?: string, options?: { recursive?: boolean }): AsyncIterable<IFsNode> {
        dir = this.getFullDir(dir);
        if (dir === "/") {
            const rootDirs = ["az", "aws", "local"];
            for (const rootDir of rootDirs) {
                yield {
                    isDir: true,
                    name: rootDir,
                };
    
                if (options?.recursive) {
                    const subPath = joinPath("/", rootDir);
                    for await (const node of this.ls(subPath, options)) {
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
        yield* this._ls(fs, path.path, options);
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
    // Count files recursively under the requested path.
    //
    private async countFiles(srcFs: IFileSystem, srcPath: string, options?: { recursive?: boolean }): Promise<number> {
        const nodes = this._ls(srcFs, srcPath, { recursive: options?.recursive });
        let fileCount = 0;
        for await (const node of nodes) {
            if (!node.isDir) {
                fileCount += 1;
            }
        }
        return fileCount;
    }

    //
    // Copies a directory recursively.
    //
    private async copyDir(srcFs: IFileSystem, srcFsId: string, srcPath: string, destFs: IFileSystem, destFsId: string, destPath: string): Promise<void> {
        
        const fileCount = await this.countFiles(srcFs, srcPath, { recursive: true });
        
        const bar = new ProgressBar("   Copying [:bar] :current/:total :percent", { 
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: fileCount,
        });

        const nodes2 = this._ls(srcFs, srcPath, { recursive: true });
        for await (const node of nodes2) {
            if (node.isDir) {
                // Skip directories. 
                // The call to _ls already recurses.
                continue;
            }

            const srcFilePath = joinPath(srcPath, node.name);
            const fileBasename = node.name;

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
    
            const destFilePath = joinPath(destPath.path, fileBasename);
            console.log(`"cp ${srcPath.fileSystem}:${srcPath.path} => ${destPath.fileSystem}:${destFilePath}"`); //todo: move into copyFile.
    
            await this.copyFile(srcFs, srcPath.path, destFs, destFilePath);            
        }
    }

    //
    // Hash an input stream.
    //
    private hashStream(input: NodeJS.ReadableStream): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            hash.setEncoding('hex');
            input.on('error', reject);

            input.on('end', () => {
                hash.end();
                resolve(hash.read()); // Retreive the hashed value.
            });
            
            input.pipe(hash); // Pipe input stream to the hash.
        });
    }

    /**
     * Compare the source directoy to the destination.
     * Returns a list of files that are different to those in the destination or that don't exist
     * in the destination at all.
     * 
     * @param src The source directory.
     * @param dest The destination directory.
     */
    async* compare(src: string, dest: string, options?: { recursive?: boolean, showIdentical?: boolean }): AsyncIterable<IFsCompareItem> {

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

        const fileCount = await this.countFiles(srcFs, srcPath.path, { recursive: options?.recursive });
        console.log(`Comparing ${fileCount} files.`);

        const bar = new ProgressBar("   Comparing [:bar] :current/:total :percent", { 
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: fileCount,
        });
        
        const nodes = this.ls(src, { recursive: options?.recursive });

        for await (const node of nodes) {
            if (node.isDir) {
                continue; // Don't need to touch directories.
            }

            const destItemPath = joinPath(destPath.path, node.name);
            if (!destFs.exists(destItemPath)) {
                yield {
                    path: node.name,
                    state: "source only",
                };
            }
            else {
                const srcItemPath = joinPath(srcPath.path, node.name);
                const [ srcStream, destStream ] = await Promise.all([
                    srcFs.createReadStream(srcItemPath),
                    destFs.createReadStream(destItemPath)
                ]);

                if (srcStream.contentLength !== destStream.contentLength) {
                    yield {
                        path: node.name,
                        state: "different",
                        reason: "content-type",
                    };
                }
                if (srcStream.contentLength !== destStream.contentLength || srcStream.contentLength !== destStream.contentLength) {
                    yield {
                        path: node.name,
                        state: "different",
                        reason: "content-length",
                    };
                }
                else {
                    const [ srcHash, destHash ] = await Promise.all([
                        this.hashStream(srcStream.stream),
                        this.hashStream(destStream.stream)
                    ]);
    
                    if (srcHash !== destHash) {
                        yield {
                            path: node.name,
                            state: "different",
                            reason: "hash",
                        };
                    }
                    else if (options?.showIdentical) {
                        yield {
                            path: node.name,
                            state: "identical",
                        };
                    }
                }
            }

            bar.tick();
        }
    }
}
 