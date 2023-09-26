'use strict';

const _ = require('lodash');
const ExtendableError = require('src/Error/ExtendableError');

class FeedLifecycleTiming {
    constructor(logger) {
        this._logger = logger;
        this._loggerWithCtx = this._logger.withContext(this.CLASS_NAME);

        this._lastSeenHeartbeat = 0;
        this._connectedTime = 0;
        this._firstSnapshotTime = 0;
        this._firstNonSnapshotTime = 0;
        this._lastSnapshotTime = 0;
        this._disconnectedTime = 0;
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

    reset() {
        this._lastSeenHeartbeat = 0;
        this._connectedTime = 0;
        this._firstSnapshotTime = 0;
        this._firstNonSnapshotTime = 0;
        this._lastSnapshotTime = 0;
        this._disconnectedTime = 0;
    }

    trackConnected(connectedTime) {
        if (!_.isInteger(connectedTime) || connectedTime <= 0) {
            throw new ExtendableError('connectedTime must be a positive integer', {connectedTime});
        }

        this._connectedTime = connectedTime;
    }

    trackDisconnected(disconnectedTime) {
        if (!_.isInteger(disconnectedTime) || disconnectedTime <= 0) {
            throw new ExtendableError('disconnectedTime must be a positive integer', {disconnectedTime});
        }

        this.reset();
        this._disconnectedTime = disconnectedTime;
    }

    trackFirstSnapshotData(firstSnapshotDataTime) {
        if (!_.isInteger(firstSnapshotDataTime) || firstSnapshotDataTime <= 0) {
            throw new ExtendableError('firstSnapshotDataTime must be a positive integer', {firstSnapshotDataTime});
        }

        if (this._firstSnapshotTime !== 0) {
            return;
        }

        this._firstSnapshotTime = firstSnapshotDataTime;

        if (this._connectedTime === 0) {
            // the completion of the connection phase wasn't tracked
            this.getLoggerWithCtx().error(
                'First snapshot data was tracked, but connection was not. Make sure the connection is tracked.'
            );
        } else {
            const fromConnectionToFirstSnapshotDataTime = this._firstSnapshotTime - this._connectedTime;

            this.getLoggerWithCtx().info(
                `Time from the connection to the first snapshot data: ${fromConnectionToFirstSnapshotDataTime}`
            );
        }
    }

    trackFirstNonSnapshotData(firstNonSnapshotDataTime) {
        if (!_.isInteger(firstNonSnapshotDataTime) || firstNonSnapshotDataTime <= 0) {
            throw new ExtendableError('firstNonSnapshotDataTime must be a positive integer', {firstNonSnapshotDataTime});
        }

        if (this._firstNonSnapshotTime !== 0) {
            return;
        }

        this._firstNonSnapshotTime = firstNonSnapshotDataTime;

        if (this._connectedTime === 0) {
            // the completion of the connection phase wasn't tracked
            this.getLoggerWithCtx().error(
                'First non-snapshot data was tracked, but connection was not. Make sure the connection is tracked.'
            );
        } else {
            const fromConnectionToFirstNonSnapshotDataTime = this._firstNonSnapshotTime - this._connectedTime;

            this.getLoggerWithCtx().info(
                `Time from the connection to the first snapshot data: ${fromConnectionToFirstNonSnapshotDataTime}`
            );
        }
    }

    trackHeartbeat(heartbeat) {
        if (!_.isInteger(heartbeat) || heartbeat <= 0) {
            throw new ExtendableError('heartbeat must be a positive integer', {heartbeat});
        }

        if (this._lastSeenHeartbeat !== 0) {
            const lastHeartbeatInterval = heartbeat - this._lastSeenHeartbeat;
            const serverAndLocalTimeDiff = Date.now() - heartbeat;

            this.getLoggerWithCtx().info(
                `Interval between prev heartbeat: ${lastHeartbeatInterval} ms`
                + `, local and server time diff: ${serverAndLocalTimeDiff} ms`
            );
        } else {
            if (this._connectedTime === 0) {
                // the completion of the connection phase wasn't tracked
                this.getLoggerWithCtx().error(
                    'First heartbeat was tracked, but connection was not. Make sure the connection is tracked.'
                );
            } else {

                const fromConnectionToFirstHeartbeat = heartbeat - this._connectedTime;

                this.getLoggerWithCtx().info(
                    `Time from the connection to the first heartbeat: ${fromConnectionToFirstHeartbeat} ms`
                );
            }
        }

        this._lastSeenHeartbeat = heartbeat;
    }

    /**
     * The difference with `trackFirstSnapshotData` consists in the fact that Feed with active setting
     * `snapshotBatchSize` may return a few of empty updates. Normally an empty update means that the snapshot
     * data has fully delivered, but due to caching mechanics in a very rare cases another empty array of updates
     * may be delivered in the middle of batches.
     *
     * That's why a few consecutive calls of this method will be treated as normal behavior.
     *
     * @param lastSnapshotDataTime
     */
    trackLastSnapshotData(lastSnapshotDataTime) {
        if (!_.isInteger(lastSnapshotDataTime) || lastSnapshotDataTime <= 0) {
            throw new ExtendableError('lastSnapshotDataTime must be a positive integer', {lastSnapshotDataTime});
        }

        this._lastSnapshotTime = lastSnapshotDataTime;

        if (this._firstSnapshotTime === 0) {
            // consistency check fail? last snapshot data can't go before the first snapshot data
            this.getLoggerWithCtx().error(
                'Last snapshot data was tracked, but first data was not. Make sure the first snapshot data is tracked.'
            );
        } else {
            const snapshotDownloadTime = this._lastSnapshotTime - this._firstSnapshotTime;
            this.getLoggerWithCtx().info(
                `Time from the first snapshot data to the last snapshot data: ${snapshotDownloadTime} ms`
            );
        }

        if (this._connectedTime === 0) {
            // the completion of the connection phase wasn't tracked
            this.getLoggerWithCtx().error(
                'Last snapshot data was tracked, but connection was not. Make sure the connection is tracked.'
            );
        } else {
            const fromConnectionToLastSnapshotDataTime = this._lastSnapshotTime - this._connectedTime;
            this.getLoggerWithCtx().info(
                `Time from the connection to the last snapshot data: ${fromConnectionToLastSnapshotDataTime} ms`
            );
        }
    }
}

module.exports = FeedLifecycleTiming;
