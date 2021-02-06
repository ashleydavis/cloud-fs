
import * as minimist from "minimist";
const argv = minimist(process.argv.slice(2));

// console.log("Raw args:");
// console.log(process.argv);

// console.log("Minimist:");
// console.log(argv);

import * as shell from "shelljs";
import * as Vorpal from "vorpal";

const app =  new Vorpal();
app
    .command("ls [dir]", "Lists files and directories.")
    .option("-l, --long", "Enables long listing format")
    .action(async args => {
        const files = shell.ls(args.dir);
        if (args.long) {
            for (const file of files) {
                console.log(file);
            }
        }
        else {
            console.log(files.join("  "));
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
   
