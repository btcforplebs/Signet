#!/usr/bin/env node
import 'websocket-polyfill';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { addKey } from './commands/add.js';
import { runStart } from './commands/start.js';

yargs(hideBin(process.argv))
    .scriptName('signet')
    .option('config', {
        alias: 'c',
        type: 'string',
        default: 'config/signet.json',
        describe: 'Path to the configuration file',
    })
    .command(
        'add',
        'Encrypt and store an nsec',
        (command) =>
            command.option('name', {
                alias: 'n',
                type: 'string',
                demandOption: true,
                describe: 'Key label to store the nsec under',
            }),
        async (argv) => {
            await addKey({
                configPath: argv.config as string,
                keyName: argv.name as string,
            });
        }
    )
    .command(
        'start',
        'Start the Signet daemon',
        (command) =>
            command
                .option('key', {
                    type: 'string',
                    array: true,
                    describe: 'Key label to unlock at startup',
                })
                .option('verbose', {
                    alias: 'v',
                    type: 'boolean',
                    default: false,
                    describe: 'Enable verbose logging',
                }),
        async (argv) => {
            await runStart({
                configPath: argv.config as string,
                keyNames: argv.key ? (argv.key as string[]) : undefined,
                verbose: Boolean(argv.verbose),
            });
        }
    )
    .demandCommand(1, 'Specify a command to run.')
    .strict()
    .help()
    .parse();
