'use strict';

const EventEmitter = require('node:events');

const {NtpTimeSync} = require('ntp-time-sync');

const SignalrConsumer = require('src/SignalrConsumer');
const FeedLifecycleTiming = require('src/FeedLifecycleTiming');
const UpdateHubMessageValidator = require('src/UpdateHubMessageValidator');

class ApplicationLogic extends EventEmitter {
    /**
     * @param {{}} applicationConfig
     * @param {Logger} logger
     */
    constructor(applicationConfig, logger) {
        super();

        this._applicationConfig = applicationConfig;
        this._logger = logger;
        this._loggerWithCtx = this._logger.withContext(this.CLASS_NAME);

        this._channel = this._applicationConfig.feed.channel;

        this._ntpChecker = NtpTimeSync.getInstance(this._applicationConfig.ntp);
        this._consumer = new SignalrConsumer(this._applicationConfig.feed, this._logger);

        this._feedLifecycleTiming = new FeedLifecycleTiming(logger);

        this._onUpdate = this._onUpdate.bind(this);
        this._onHeartbeat = this._onHeartbeat.bind(this);
        this._onConnectionStatusChange = this._onConnectionStatusChange.bind(this);
    }

    get CLASS_NAME() {
        return this.constructor.name;
    }

    /**
     * @returns {Logger}
     */
    getLogger() {
        return this._logger;
    }

    /**
     * @returns {Logger}
     */
    getLoggerWithCtx() {
        return this._loggerWithCtx;
    }

    async bootstrap() {
        this.getLoggerWithCtx().info('Bootstrapping...');
    }

    async start() {
        this.getLoggerWithCtx().info('Starting...');

        this.getLoggerWithCtx().info('Fetching NTP time...');
        const ntpTime = await this._ntpChecker.getTime();
        this.getLoggerWithCtx().info(`System time: ${(new Date()).toISOString()}, NTP time: ${ntpTime.now.toISOString()}, diff: ${ntpTime.offset}`);

        this._consumer.on(this._consumer.EVENT_NAME_DATA, this._onUpdate);
        this._consumer.on(this._consumer.EVENT_NAME_HEARTBEAT, this._onHeartbeat);
        this._consumer.on(this._consumer.EVENT_NAME_CONNECTION_STATUS_CHANGE, this._onConnectionStatusChange);

        this.getLoggerWithCtx().info('Starting consumer...');

        await this._consumer.start();
    }

    async stop() {
        this.getLoggerWithCtx().info('Stopping...');

        await this._consumer.stop();

        this._consumer.removeListener(this._consumer.EVENT_NAME_DATA, this._onUpdate);
        this._consumer.removeListener(this._consumer.EVENT_NAME_HEARTBEAT, this._onHeartbeat);
        this._consumer.removeListener(
            this._consumer.EVENT_NAME_CONNECTION_STATUS_CHANGE,
            this._onConnectionStatusChange
        );

        this._feedLifecycleTiming.reset();
    }

    async _onUpdate(channel, updatesArray) {
        this.getLoggerWithCtx().info('Received data from onUpdate hub', {channel: channel, updatesAmount: updatesArray.length});

        if (UpdateHubMessageValidator.isNonEmptyArray(updatesArray)) {
            const firstElement = updatesArray[0];

            if (UpdateHubMessageValidator.isValidSnapshotData(firstElement)) {
                this._feedLifecycleTiming.trackFirstSnapshotData(Date.now());
            } else if (UpdateHubMessageValidator.isValidNonSnapshotData(firstElement)) {
                this._feedLifecycleTiming.trackFirstNonSnapshotData(Date.now());
            } else {
                this.getLoggerWithCtx().error(
                    'Invalid data format of the first element of the array received from onUpdate hub', {firstElement}
                );
            }
        } else {
            // empty array with `snapshotBatchSize` may be an indicator of the last snapshot data
            this._feedLifecycleTiming.trackLastSnapshotData(Date.now());
        }
    }

    async _onHeartbeat(channel, heartbeat) {
        this.getLoggerWithCtx().debug('Received data from onHeartbeat hub', {channel, heartbeat});

        this._feedLifecycleTiming.trackHeartbeat(heartbeat);
    }

    async _onConnectionStatusChange(channel, statusData) {
        if (statusData && statusData.status) {
            if (statusData.status === 'connected') {
                this._feedLifecycleTiming.trackConnected(statusData.timestamp);

                this.getLoggerWithCtx().info('Connection status has changed', {channel: channel, statusData});
            } else if (statusData.status === 'disconnected') {
                this._feedLifecycleTiming.trackDisconnected(statusData.timestamp);

                this.getLoggerWithCtx().warn('Connection status has changed', {channel: channel, statusData});
            }
        }
    }
}

module.exports = ApplicationLogic;
