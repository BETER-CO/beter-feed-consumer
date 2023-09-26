'use strict';

const _ = require('lodash');
const ExtendableError = require('src/Error/ExtendableError');

function isArray(data) {
    return _.isArray(data);
}

function isNonEmptyArray(data) {
    return isArray(data) && data.length > 0;
}

function isValidUpdateMessage(data) {
    return _.isPlainObject(data) && _.has(data, 'msgType') && _.isInteger(data.msgType);
}

function isValidSnapshotData(data) {
    return isValidUpdateMessage(data) && data.msgType === 2;
}

function isValidNonSnapshotData(data) {
    return isValidUpdateMessage(data) && (data.msgType !== 2);
}

module.exports = {
    isArray,
    isNonEmptyArray,
    isValidSnapshotData,
    isValidNonSnapshotData,
};
