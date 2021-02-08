import { AzureFileSystem } from "./plugins/azure";
import { IFileSystem } from "./plugins/file-system";
import { LocalFileSystem } from "./plugins/local";
import * as path from "path";

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

    //
    // Pipe input stream to output stream and await completion.
    //
    private waitPipe(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            input.pipe(output)
                .on("error", reject)
                .on("finish", resolve);
        });
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
        const output = await destFs.createWriteStream(destFilePath);
        await this.waitPipe(input, output);
    }

    /**
     * Copies files and directories from one place to another (including from one cloud vendor to another).
     * 
     * @param src The source file or directory to copy.
     * @param dest The destination directory to copy to.
     */
    async cp(src: string, dest: string): Promise<void> {
        const srcPath = this.parsePath(src);
        const destPath = this.parsePath(dest);
        const srcFs = fileSystems[srcPath.fileSystem];
        const destFs = fileSystems[destPath.fileSystem];
        const isSrcDirectory = srcPath.path[srcPath.path.length-1] === "/";
        if (isSrcDirectory) {
            const files = srcFs.ls(srcPath.path);
            for await (const fileName of files) {
                const srcFilePath = joinPath(srcPath.path, fileName);
                const fileBasename = fileName;
    
                await destFs.ensureDir(destPath.path);
        
                const destFilePath = joinPath(destPath.path, fileBasename);
                console.log(`cp ${srcPath.fileSystem}:${srcFilePath} => ${destPath.fileSystem}:${destFilePath}`);
        
                await this.copyFile(srcFs, srcFilePath, destFs, destFilePath);            
            }
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
