/*
Interface to AWS S3 file storage.

Configuration:

???

https://www.npmjs.com/package/aws-sdk
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/welcome.html
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-your-credentials.html
*/

import { IFileSystem, IFsNode } from "./file-system";
import * as aws from "aws-sdk";
import * as path from "path";
import { PassThrough } from "stream";

export class AWSFileSystem implements IFileSystem {

    private s3: aws.S3;
    
    constructor() {
        this.s3 = new aws.S3();
    }  

    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir: string): AsyncIterable<IFsNode> {
        throw new Error("Not implemented");
    }


    /**
     * Ensure that the requested directory exists, creates it if it doesn't exist.
     * 
     * @param dir The directory to create.
     */
    async ensureDir(dir: string): Promise<void> {
        // todo: throw new Error("Not implemented");
    }

    /**
     * Returns true if the specified file already exists in the file system.
     * 
     * @param file The file to check for existance.
     */
    async exists(file: string): Promise<boolean> {
        // todo: throw new Error("Not implemented");
        return false;
    }

    /**
     * Creates a readable stream for a file.
     * 
     * @param file The file to open.
     */
    async createReadStream(file: string): Promise<NodeJS.ReadableStream> {
        throw new Error("Not implemented");
    }        

    /**
     * Creates a writable stream for a file.
     * 
     * @param file The file to open.
     */
    async createWriteStream(file: string): Promise<NodeJS.WritableStream> {
        if (file[0] === "/") {
            file = file.substring(1);
        }
        const slashIndex = file.indexOf("/");
        const bucketName = file.substring(0, slashIndex);
        const key = file.substring(slashIndex+1);

        const passThru = new PassThrough();
        const params = {
            Bucket: bucketName, 
            Key: key, 
            Body: passThru,
        };

        this.s3.upload(params, (err: Error) => {
            if (err) {
                console.error("Error uploading to s3:")
                console.error(err && err.stack || err);
            }
        });
          
        return passThru;
    }

}
