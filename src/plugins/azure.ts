/*
Interface to Azure file storage.

Configuration:

export AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

Or 

set AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs
*/

import { IFileReadResponse, IFileSystem, IFsNode } from "./file-system";
import { BlobServiceClient } from '@azure/storage-blob';
import * as path from "path";

export class AzureFileSystem implements IFileSystem {

    private blobService: BlobServiceClient;
    
    constructor() {
        const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING as string;
        if (!AZURE_STORAGE_CONNECTION_STRING) {
            throw new Error("Please provide Azure storage connection string in the environment variable AZURE_STORAGE_CONNECTION_STRING.");
        }
        this.blobService = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    }  

    //
    // Enumerates all containers in the storage account.
    private async* enumerateContainers(): AsyncIterable<IFsNode> {
        for await (const container of this.blobService.listContainers()) {
            yield {
                isDir: true,
                name: container.name,
            };
        }
    }

    //
    // Enumerates all blogs under the particular directory.
    //
    private async* enumerateBlobs(dir: string): AsyncIterable<IFsNode> {
        if (dir[0] === "/") {
            dir = dir.substring(1);
        }
        const slashIndex = dir.indexOf("/");
        const containerName = slashIndex >= 0 ? dir.substring(0, slashIndex) : dir;
        let blobPath = slashIndex >= 0 ? dir.substring(slashIndex+1) : "";
        if (blobPath.length > 0) {
            if (blobPath[blobPath.length-1] !== "/") {
                blobPath += "/";
            }
        }

        const containerClient = this.blobService.getContainerClient(containerName);
        for await (const item of containerClient.listBlobsByHierarchy("/",  { prefix: blobPath })) {
            const blobClient = containerClient.getBlobClient(item.name);
            const metadata = await blobClient.getProperties();

            yield {
                isDir: item.kind === "prefix",
                name: path.basename(item.name),
                contentType: metadata.contentType,
                contentLength: metadata.contentLength,
            };
        }
    }

    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir: string): AsyncIterable<IFsNode> {
        if (dir === "" || dir === "/") {
            yield* this.enumerateContainers();
        }
        else {
            yield* this.enumerateBlobs(dir);
        }
    }

    /**
     * Returns true if the specified file already exists in the file system.
     * 
     * @param file The file to check for existance.
     */
    async exists(file: string): Promise<boolean> {
        throw new Error("Not implemented");
    }

    /**
     * Creates a readable stream for a file.
     * 
     * @param file The file to open.
     */
    async createReadStream(file: string): Promise<IFileReadResponse> {
        if (file[0] === "/") {
            file = file.substring(1);
        }
        const slashIndex = file.indexOf("/");
        const containerName = file.substring(0, slashIndex);
        const blobPath = file.substring(slashIndex+1);

        const containerClient = this.blobService.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobPath);
        const response = await blobClient.download();
        return {
            contentType: response.contentType,
            contentLength: response.contentLength,
            stream: response.readableStreamBody!
        };
    }

    /**
     * Writes an input stream to a file.
     * 
     * @param file The file to write to.
     */
    async copyStreamTo(file: string, input: IFileReadResponse): Promise<void> {
        throw new Error("Not implemented");
    }

}
