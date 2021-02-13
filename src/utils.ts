import * as crypto from "crypto";
import * as path from "path";

//
// Pipe input stream to output stream and await completion.
//
export function waitPipe(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        input.pipe(output)
            .on("error", reject)
            .on("finish", resolve);
    });
}

//
// Normalizes a path.
//
export function normalizePath(path: string): string {
    return path.replace(/\\/g, "/");
}

//
// Joins paths.
//
export function joinPath(...args: string[]): string {
    return normalizePath(path.join(...args));
}

//
// Hash an input stream.
//
export function hashStream(input: NodeJS.ReadableStream): Promise<number> {
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

//
// Sleep for a specified number of milliseconds.
//
export function sleep(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
        setTimeout(resolve, ms);
    });
}
