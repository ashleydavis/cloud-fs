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

import { IFileReadResponse, IFileSystem, IFsNode } from "./file-system";
import * as aws from "aws-sdk";
import { S3 } from "aws-sdk";

export class AWSFileSystem implements IFileSystem {

    private s3: aws.S3;
    
    constructor() {
        this.s3 = new aws.S3();
    }  

    //
    // Extract relevant details from the path.
    //
    private extractPath(file: string) {
        if (file[0] === "/") {
            file = file.substring(1);
        }
        const slashIndex = file.indexOf("/");
        const bucketName = file.substring(0, slashIndex);
        const key = file.substring(slashIndex + 1);
        return { 
            Bucket: bucketName, 
            Key: key,
        };
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
     * Returns true if the specified file already exists in the file system.
     * 
     * @param file The file to check for existance.
     */
    async exists(file: string): Promise<boolean> {
        try { 
            await this.s3.headObject(this.extractPath(file)).promise();
            return true;
        } 
        catch (err) {
            if (err.code === 'NotFound') {
                return false;
            }
            else {
                throw err;
            }
        }
    }   
    
    //
    // Gets metadata for the asset.
    //
    private getMetadata(params: S3.Types.HeadObjectRequest): Promise<S3.Types.HeadObjectOutput> {
        return new Promise<S3.Types.HeadObjectOutput>((resolve, reject) => {
            this.s3.headObject(params,
                (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                }
            );
        });
    }

    /**
     * Creates a readable stream for a file.
     * 
     * @param file The file to open.
     */
    async createReadStream(file: string): Promise<IFileReadResponse> {
        const params = this.extractPath(file);
        const metadata = await this.getMetadata(params);
        if (!metadata) {
            throw new Error(`Failed to load metadata for file ${file}.`);
        }
        return {
            stream: this.s3.getObject(params)
                .createReadStream(),
            contentType: metadata.ContentType,
            contentLength: metadata.ContentLength,
        };
    }        

    /**
     * Writes an input stream to a file.
     * 
     * @param file The file to write to.
     */
    copyStreamTo(file: string, input: IFileReadResponse): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const { Bucket, Key } = this.extractPath(file);
            const params: S3.Types.PutObjectRequest = {
                Bucket: Bucket, 
                Key: Key, 
                Body: input.stream,
                ContentType: input.contentType,
                ContentLength: input.contentLength,
            };    
            this.s3.upload(params, (err: Error) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
