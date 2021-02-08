
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
