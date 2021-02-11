import * as Vorpal from "vorpal";
import { CloudFS } from ".";
const app =  new Vorpal();
const cloudFS = new CloudFS();

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
    .option("-l, --long", "Enables long listing format")
    // .example("ls subdir", "Lists files and directories under 'subdir'.")
    // .example("ls aws:subdir", "Lists files and directories in AWS under 'subdir'.")
    .action(wrapAction(async args => {
        const nodes = cloudFS.ls(args.dir && args.dir.trim());
        if (args.long) {
            for await (const node of nodes) {
                if (node.isDir) {
                    console.log(`${node.name}/`);
                }
                else {
                    console.log(node);
                }
            }
        }
        else {
            for await (const node of nodes) {
                process.stdout.write(node.name);
                if (node.isDir) {
                    process.stdout.write("/");    
                }
                process.stdout.write("  ");
            }
            process.stdout.write("\n");
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

if (process.argv.length === 2) {
    app
        .delimiter('cloud>')
        .show();
}
else {
    app.parse(process.argv);
}
   
