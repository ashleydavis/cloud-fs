/*
Interface to Azure file storage.

Configuration:

export AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

Or 

set AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>

https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs
https://docs.microsoft.com/en-us/javascript/api/@azure/storage-blob/
https://github.com/Azure-Samples/azure-sdk-for-js-storage-blob-stream-nodejs/
*/

import { IFileReadResponse, IFileSystem, IFsNode } from "../file-system";
import { BlobBatch, BlobGetPropertiesResponse, BlobServiceClient, BlockBlobUploadStreamOptions } from '@azure/storage-blob';
import * as path from "path";
import { Readable } from "stream";

export default class AzureFileSystem implements IFileSystem {

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

            const isDir = item.kind === "prefix";
            let metadata: BlobGetPropertiesResponse | undefined;
            if (!isDir) {
                const blobClient = containerClient.getBlobClient(item.name);
                metadata = await blobClient.getProperties();
            }

            yield {
                isDir: isDir,
                name: path.basename(item.name),
                contentType: metadata?.contentType,
                contentLength: metadata?.contentLength,
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
        const slashIndex = file.indexOf("/"); //todo: share this setup code.
        const containerName = file.substring(0, slashIndex);
        const blobPath = file.substring(slashIndex+1);
        const containerClient = this.blobService.getContainerClient(containerName);
        const blobClient = containerClient.getBlockBlobClient(blobPath);
        return await blobClient.exists();
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
        const blobClient = containerClient.getBlockBlobClient(blobPath);
        const response = await blobClient.download();
        return {
            contentType: response.contentType,
            contentLength: response.contentLength,
            stream: response.readableStreamBody! as Readable, //TODO: Does this work???
        };
    }

    /**
     * Writes an input stream to a file.
     * 
     * @param file The file to write to.
     */
    async copyStreamTo(file: string, input: IFileReadResponse): Promise<void> {
        if (file[0] === "/") {
            file = file.substring(1);
        }
        const slashIndex = file.indexOf("/");
        const containerName = file.substring(0, slashIndex);
        const blobPath = file.substring(slashIndex+1);
        const containerClient = this.blobService.getContainerClient(containerName);
        await containerClient.createIfNotExists();
        const blobClient = containerClient.getBlockBlobClient(blobPath);
        let options: BlockBlobUploadStreamOptions = {};
        if (input.contentType) {
            options.blobHTTPHeaders = {
                blobContentType: input.contentType,
            };
        }
        await blobClient.uploadStream(input.stream, undefined, undefined, options);
    }
}
