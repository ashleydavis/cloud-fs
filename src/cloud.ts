import * as Vorpal from "vorpal";
import { CloudFS } from ".";
const app =  new Vorpal();
const cloudFS = new CloudFS();
const AsciiTable = require('ascii-table');

type VorpalFn = (args: Vorpal.Args) => Promise<void>;

//
// Wrap functions because Vorpal doesn't appear to handle rejected promies.
//
function wrapAction(fn: VorpalFn): VorpalFn {
    return async (args: Vorpal.Args) => {
        try {
            await fn(args);
        }
        catch (err) {
            console.error(`Failed with error:`);
            if (err.stack) {
                console.error(err.stack);
            }
            else if (err.message) {
                console.error(err.message);
            }
            else {
                console.error(err);
            }
            process.exit(1);
        }
    }
}

app
    .command("pwd", "Prints the current working directory.")
    .action(wrapAction(async args => {
        console.log(cloudFS.pwd());
    }));

app
    .command("cd <dir>", "Changes the working directory.")
    // .example("cd /", "Change to the root directory.")
    // .example("cd /aws", "Change to the root directory for AWS storage.")
    // .example("cd /az", "Change to the root directory for Azure storage.")
    .action(wrapAction(async args => {
        cloudFS.cd(args.dir);
    }));
    
app
    .command("ls [dir]", "Lists files and directories.")
    .option("-r, --recursive", "Lists all files recursively")
    // .example("ls subdir", "Lists files and directories under 'subdir'.")
    // .example("ls aws:subdir", "Lists files and directories in AWS under 'subdir'.")
    .action(wrapAction(async args => {
        const dir = args.dir && args.dir.trim();
        const nodes = cloudFS.ls(dir, args.options.recursive);
        let fileCount = 0;
        let dirCount = 0;

        const table = new AsciiTable(`ls`);
        table.setHeading("File", "Type", "Length");

        for await (const node of nodes) {
            if (node.isDir) {
                table.addRow(`${node.name}/`, "", "");
                dirCount += 1;
            }
            else {
                table.addRow(node.name, node.contentType ?? "", node.contentLength ?? "");
                fileCount += 1;
            }
        }

        if ((dirCount + fileCount) > 0) {
            console.log(table.toString());

            console.log(`\r\n${fileCount} files. ${dirCount} directories.`);
            }
        else {
            console.log(`No results were found.`);
        }
    }));

app
    .command("cp <src> <dest>", "Copies files and directories.")
    // .example("cp somefile.txt someotherfile.txt", "Copy a file from one place to another.")
    // .example("cp somefile.txt somedirectory/", "Copy a file to an output directory.")
    // .example("cp somedirectory/ someotherdirectory/", "Copies all files in some directory to another directory.")
    .action(wrapAction(async args => {
        await cloudFS.cp(args.src.trim(), args.dest.trim());
    }));

app
    .command("compare <src> <dest>", "Copies to directories and lists files from the source that are different in the destination or don't exists at all there.")
    .option("-r, --recursive", "Compoares files recursively.")
    .option("-i, --identical", "Show results for identical files (as well as different/source only.")
    .action(wrapAction(async args => {
        await cloudFS.compare(args.src.trim(), args.dest.trim(), { recursive: args.options.recursive, showIdentical: args.options.identical });
    }));

if (process.argv.length === 2) {
    app
        .delimiter('cloud>')
        .show();
}
else {
    app.parse(process.argv);
}
   
