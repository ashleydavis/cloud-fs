/*
Interface to Azure file storage.

Configuration:

export AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

Or 

set AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs
*/

import { IFileSystem } from "./file-system";
import { BlobServiceClient } from '@azure/storage-blob';
import * as path from "path";
import { Console } from "console";

export class AzureFileSystem implements IFileSystem {

    private blobService: BlobServiceClient;
    
    constructor() {
        this.blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING as string);
    }  

    //
    // Enumerates all containers in the storage account.
    private async* enumerateContainers(): AsyncIterable<string> {
        for await (const container of this.blobService.listContainers()) {
            yield container.name;
        }
    }

    //
    // Enumerates all blogs under the particular directory.
    //
    private async* enumerateBlobs(dir: string): AsyncIterable<string> {
        const slashIndex = dir.indexOf("/");
        const containerName = dir.substring(0, slashIndex);
        const blobPath = dir.substring(slashIndex);

        const containerClient = this.blobService.getContainerClient(containerName);
        for await (const item of containerClient.listBlobsByHierarchy(blobPath)) {
            yield path.basename(item.name);
        }
    }

    /**
     * Lists files and directories.
     * 
     * @param dir List files and directories under this directory.
     */
    async* ls(dir: string): AsyncIterable<string> {
        if (dir === "." || dir === "/") { //todo: cope with cur directory properly
            yield* this.enumerateContainers();
        }
        else {
            yield* this.enumerateBlobs(dir);
        }
    }


    /**
     * Ensure that the requested directory exists, creates it if it doesn't exist.
     * 
     * @param dir The directory to create.
     */
    async ensureDir(dir: string): Promise<void> {
        throw new Error("Not implemented");
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
    async createReadStream(file: string): Promise<NodeJS.ReadableStream> {
        const slashIndex = file.indexOf("/");
        const containerName = file.substring(0, slashIndex);
        const blobPath = file.substring(slashIndex+1);

        const containerClient = this.blobService.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobPath);
        const response = await blobClient.download();
        return response.readableStreamBody!;
    }

    /**
     * Creates a writable stream for a file.
     * 
     * @param file The file to open.
     */
    async createWriteStream(file: string): Promise<NodeJS.WritableStream> {
        throw new Error("Not implemented");
    }

}
