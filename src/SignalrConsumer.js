'use strict';

const EventEmitter = require('node:events');

const {v4: uuid} = require('uuid');
const signalR = require('@microsoft/signalr');

const ExtendableError = require('src/Error/ExtendableError');

const HUB_NAME_ON_UPDATE = 'OnUpdate';
const HUB_NAME_ON_HEARTBEAT = 'OnHeartbeat';
const EVENT_NAME_DATA = 'data';
const EVENT_NAME_HEARTBEAT = 'heartbeat';
const EVENT_NAME_CONNECTION_STATUS_CHANGE = 'connectionStatus';

class SignalrConsumer extends EventEmitter {
    static get STATUS_STOPPED() {
        return 1;
    }

    static get STATUS_STARTED() {
        return 2;
    }

    static get STATUS_STARTING() {
        return 3;
    }

    static get STATUS_STOPPING() {
        return 4;
    }

    constructor(config, logger) {
        super();

        this._status = SignalrConsumer.STATUS_STOPPED;

        this._id = uuid();
        this._logger = logger;
        this._loggerWithCtx = this._logger.withContext(`[${this.CLASS_NAME}][${this._id}]`);

        this._channel = config.channel;
        this._connectionUri = this._buildConnectionUrl(config);
        this._connection = new signalR.HubConnectionBuilder()
            .withUrl(this._connectionUri)
            .build();

        this._connectionId = null;

        this._connection.onclose(this._onSignalrConnectionClose.bind(this));
        this._connection.onreconnecting(this._onSignalrReconnecting.bind(this));
        this._connection.onreconnected(this._onSignalrReconnected.bind(this));

        this._connection.serverTimeoutInMilliseconds = 15000;
        this._connection.keepAliveIntervalInMilliseconds = 5000;


        this._onUpdate = this._onUpdate.bind(this);
        this._onHeartbeat = this._onHeartbeat.bind(this);
    }

    get CLASS_NAME() {
        return this.constructor.name;
    }

    get EVENT_NAME_DATA() {
        return EVENT_NAME_DATA;
    }

    get EVENT_NAME_HEARTBEAT() {
        return EVENT_NAME_HEARTBEAT;
    }

    get EVENT_NAME_CONNECTION_STATUS_CHANGE() {
        return EVENT_NAME_CONNECTION_STATUS_CHANGE;
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

    isStarted() {
        return this._status === SignalrConsumer.STATUS_STARTED;
    }

    isStarting() {
        return this._status === SignalrConsumer.STATUS_STARTING;
    }

    isStopped() {
        return this._status === SignalrConsumer.STATUS_STOPPED;
    }

    isStopping() {
        return this._status === SignalrConsumer.STATUS_STOPPING;
    }

    getConnectionId() {
        return this._connectionId;
    }

    setConnectionId(connectionId) {
        this._connectionId = connectionId;
    }

    resetConnectionId() {
        this._connectionId = null;
    }

    async start() {
        if (!this.isStopped()) {
            throw new ExtendableError(`${this.CLASS_NAME} is not stopped and can not be started so`);
        }

        try {
            this._status = SignalrConsumer.STATUS_STARTING;

            this._connection.on(HUB_NAME_ON_UPDATE, this._onUpdate);
            this._connection.on(HUB_NAME_ON_HEARTBEAT, this._onHeartbeat);

            await this._connection.start();
            this._status = SignalrConsumer.STATUS_STARTED;
            this.setConnectionId(this._connection.connectionId);

            this.getLoggerWithCtx().info('Connected to Feed', {connectionId: this.getConnectionId()});

            this.emit(
                this.EVENT_NAME_CONNECTION_STATUS_CHANGE,
                this._channel,
                {
                    status: 'connected',
                    connectionId: this.getConnectionId(),
                    timestamp: Date.now(),
                }
            );
        } catch (err) {
            this._status = SignalrConsumer.STATUS_STOPPED;

            this.getLoggerWithCtx().error(err.message, err);

            throw new ExtendableError(`${this.CLASS_NAME} failed to start`, err);
        }
    }

    async stop() {
        if (!this.isStarted()) {
            throw new ExtendableError(`${this.CLASS_NAME} is not started and can not be stopped so`);
        }

        let errorDuringStop = null;

        this._status = SignalrConsumer.STATUS_STOPPING;

        try {
            await this._connection.stop();
        } catch (err) {
            errorDuringStop = err;
        } finally {
            this._postStopActions();
        }

        if (errorDuringStop) {
            throw errorDuringStop;
        }
    }

    _buildConnectionUrl(config = {}) {
        return `https://${config.domain}/${config.channel}?ApiKey=${config.apiKey}&snapshotBatchSize=10`;
    }

    _postStopActions() {
        this._connection.off(HUB_NAME_ON_UPDATE, this._onUpdate);
        this._connection.off(HUB_NAME_ON_HEARTBEAT, this._onHeartbeat);

        this.emit(
            this.EVENT_NAME_CONNECTION_STATUS_CHANGE,
            this._channel,
            {
                status: 'disconnected',
                connectionId: this.getConnectionId(),
                timestamp: Date.now(),
            }
        );


        this.resetConnectionId();
        this._status = SignalrConsumer.STATUS_STOPPED;
    }

    _onSignalrConnectionClose(error) {
        if (error) {
            this.getLoggerWithCtx().error('SignalR client unexpectedly disconnected', {error});
            this._postStopActions();
        }
    }

    _onSignalrReconnecting(error) {
        this.getLoggerWithCtx().warn('SignalR client fired reconnecting event', {error});
    }

    _onSignalrReconnected(connectionId) {
        this.getLoggerWithCtx().warn('SignalR client fired reconnected event', {connectionId});
    }

    _onUpdate(data) {
        const len = data.length;
        this.getLoggerWithCtx().debug(`Invocation ${HUB_NAME_ON_UPDATE}: received ${len} updates`);

        this.emit(this.EVENT_NAME_DATA, this._channel, data);
    }

    _onHeartbeat(data) {
        this.getLoggerWithCtx().debug(`Invocation ${HUB_NAME_ON_HEARTBEAT}: ${data}`);

        this.emit(this.EVENT_NAME_HEARTBEAT, this._channel, data);
    }
}

module.exports = SignalrConsumer;
