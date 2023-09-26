'use strict';

require('app-module-path').addPath(__dirname);
const {Command, Option} = require('commander');
const {Logger, ErrorFormatterFactory} = require('logger');

const ApplicationLogic = require('./src/ApplicationLogic');

const errorFormatter = new ErrorFormatterFactory().create();

function buildLoggerConfig(globalOptions) {
    return {
        console: {
            "level": globalOptions.logLevel,
        },
        logstash: null,
    };
}

function buildApplicationConfig(globalOptions) {
    return {
        feed: {
            domain: globalOptions.feedDomain,
            channel: globalOptions.channelName,
            apiKey: globalOptions.apiKey,
        },
        ntp: {
            servers: [
                'pl.pool.ntp.org',
            ],
            replyTimeout: 6000,
        },
    }
}

async function startApplications(applicationLogic, logger) {
    await applicationLogic.bootstrap();
    await applicationLogic.start();

    logger.info('Application started');
}

async function stopApplications(applicationLogic, logger, emergency = false) {
    logger.info('Application is stopping...');

    try {
        await applicationLogic.stop();
    } catch (err) {
        logger.error('Error during the application stopping: ', err);
        emergency = true;
    }

    logger.info('Application successfully stopped');

    try {
        logger.info('Logger is stopping...');
        logger.close();

        setTimeout(() => process.exit(emergency ? 1 : 0), 5000);
    } catch (err) {
        const formattedTransportError = errorFormatter('Logger error', err);

        console.log(formattedTransportError.formattedMessage, formattedTransportError.formattedException);

        setTimeout(() => process.exit(emergency ? 1 : 0), 5000);
    }
}

async function init(applicationLogic, logger) {
    process.on('SIGTERM', () => {
        logger.info('Received signal "SIGTERM"');
        stopApplications(applicationLogic, logger)
            .catch(err => {
                console.error(err);
            });
    });
    process.on('SIGINT', () => {
        logger.info('Received signal "SIGINT"');
        stopApplications(applicationLogic, logger)
            .catch(err => {
                console.error(err);
            });
    });

    process.on('unhandledRejection', reason => {
        logger.error(reason.message || reason, reason);
    });

    process.on('uncaughtException', uncaughtException => {
        const formattedUncaughtException = errorFormatter('uncaughtException', uncaughtException);

        console.log(formattedUncaughtException.formattedMessage, formattedUncaughtException.formattedException);
        logger.error(formattedUncaughtException.message, uncaughtException, transportError => {
            if (transportError) {
                const formattedTransportError = errorFormatter('transportError', transportError);

                console.log(formattedTransportError.formattedMessage, formattedTransportError.formattedException);
            }
        });
    });

    logger.on('error', (err, transport) => {
        const transportName = (transport && transport.name) ? transport.name : 'unnamedTransport';
        const formattedTransportError = errorFormatter(`${transportName} error`, err);

        console.log(formattedTransportError.formattedMessage, formattedTransportError.formattedException);
    });
}


const program = new Command();
program.description('Tool to consume the BETER\'s Feed');
program.addOption(new Option('--logLevel <logLevel>', 'Logging level').choices(['debug', 'info', 'warn', 'error']).default('info'));
program.addOption(new Option('-d, --feed-domain <feedDomain>', 'Feed domain').makeOptionMandatory());
program.addOption(new Option('-k, --api-key <apiKey>', 'API Key').makeOptionMandatory());
program.addOption(new Option('-c, --channel-name <string>', 'Channel name').makeOptionMandatory());
//program.addOption(new Option('-n, --skip-ntp-check', 'Skip NTP check').default(false));
program
    .command('start')
    .description('Starts consumption')
    .action(async () => {
        const globalOpts = program.opts();

        const loggerConfig = buildLoggerConfig(globalOpts);
        const applicationConfig = buildApplicationConfig(globalOpts);

        const logger = new Logger(loggerConfig);

        const applicationLogic = new ApplicationLogic(applicationConfig, logger);

        await init(applicationLogic, logger);

        startApplications(applicationLogic, logger)
            .catch(err => {
                try {
                    logger.error(err);
                    logger.close();
                } catch (loggerErr) {
                    const formattedTransportError = errorFormatter('Logger error', loggerErr);

                    console.log(formattedTransportError.formattedMessage, formattedTransportError.formattedException);
                } finally {
                    setTimeout(() => process.exit(1), 1000);
                }
            });
    });

program.parse();
