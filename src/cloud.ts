import * as Vorpal from "vorpal";
import { CloudFS } from ".";
const app =  new Vorpal();
const cloudFS = new CloudFS();

app
    .command("ls [dir]", "Lists files and directories.")
    .option("-l, --long", "Enables long listing format")
    // .example("ls subdir", "Lists files and directories under 'subdir'.")
    // .example("ls aws:subdir", "Lists files and directories in AWS under 'subdir'.")
    .action(async args => {
        const files = cloudFS.ls(args.dir || ".");
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
   
