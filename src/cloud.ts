import * as path from "path";
import * as shell from "shelljs";
import * as Vorpal from "vorpal";
import { BlobServiceClient } from '@azure/storage-blob';

export interface IFileSystem {

    ls(dir: string): AsyncIterable<string>;
}

/*
Configuration:

AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY, or AZURE_STORAGE_CONNECTION_STRING

FIO
https://www.npmjs.com/package/azure-storage
https://github.com/Azure/azure-storage-node
https://docs.microsoft.com/en-au/javascript/api/azure-storage/?view=azure-node-legacy
http://azure.github.io/azure-storage-node/
https://docs.microsoft.com/en-au/javascript/api/azure-storage/azurestorage.services.blob.blobservice.blobservice?view=azure-node-legacy

https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs
*/

export class AzureFileSystem implements IFileSystem {

    private blobService: BlobServiceClient;
    
    constructor() {
        this.blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING as string);
    }

    private async* enumerateContainers(): AsyncIterable<string> {

        for await (const container of this.blobService.listContainers()) {
            yield container.name; //todo: other properties for long format.
        }
    }

    private async* enumerateBlobs(dir: string): AsyncIterable<string> {
        const slashIndex = dir.indexOf("/");
        const containerName = dir.substring(0, slashIndex);
        const blobPath = dir.substring(slashIndex);
        
        const containerClient = this.blobService.getContainerClient(containerName);
        for await (const item of containerClient.listBlobsByHierarchy(blobPath)) {
            yield path.basename(item.name); //todo: return metadata in long format.
        }
    }

    async* ls(dir: string): AsyncIterable<string> {
        if (dir === "." || dir === "/") { //todo: cope with cur directory properly
            yield* this.enumerateContainers();
        }
        else {
            yield* this.enumerateBlobs(dir);
        }
    }
}

export class LocalFileSystem implements IFileSystem {
    async* ls(dir: string): AsyncIterable<string> {
        for (const item of shell.ls(dir)) {
            yield item;
        }
    }
}

interface IParsedPath {
    fileSystem: string;
    path: string;
}

function parsePath(path: string): IParsedPath {
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

const fileSystems: { [name: string]: IFileSystem } = {
    local: new LocalFileSystem(),
    az: new AzureFileSystem(),
};

const app =  new Vorpal();
app
    .command("ls [dir]", "Lists files and directories.")
    .option("-l, --long", "Enables long listing format")
    // .example("ls subdir", "Lists files and directories under 'subdir'.")
    // .example("ls aws:subdir", "Lists files and directories in AWS under 'subdir'.")
    .action(async args => {
        const path = parsePath(args.dir || ".");
        const fs = fileSystems[path.fileSystem];
        const files = fs.ls(path.path);
        if (args.long) {
            for await (const file of files) {
                console.log(file);
            }
        }
        else {
            for await (const file of files) {
                process.stdout.write(file);
                process.stdout.write("  ");
            }
        }
    });

if (process.argv.length === 2) {
    app
        .delimiter('cloud>')
        .show();
}
else {
    app.parse(process.argv);
}
   
