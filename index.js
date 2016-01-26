"use strict";

const yaml_config = require('node-yaml-config');

const Bluebird = require('bluebird');
const Disney = require("wdwjs");
const twilio = require('twilio')

var config = yaml_config.load(__dirname + '/config.yml');

const disneyApi = new Disney(config.services.disney.options);
const magicKingdom = disneyApi.MagicKingdom;

const client = twilio(config.services.twilio.accountSid, config.services.twilio.authToken);

function splitWaitTimes(notifications, active) {
    return function(waitTimes) {
        const shortLines = waitTimes.filter(function (item) {
            return item.active &&
                !active.has(item.id) &&
                `_${item.id}` in notifications &&
                item.waitTime <= notifications[`_${item.id}`].threshold;
        });

        const longLines  = waitTimes.filter(function (item) {
            return item.active &&
                    active.has(item.id) &&
                    `_${item.id}` in notifications &&
                    item.waitTime > notifications[`_${item.id}`].threshold;
        });

        return {shortLines, longLines};
    };
}

const createMessage = Bluebird.promisify(client.messages.create);
function sendShortNotifications(lines) {
    return Bluebird.map(lines.shortLines, function (item) {
        console.log(`Quick! Only a ${item.waitTime} minute wait to ride '${item.name}'`);
        /*return createMessage({
            to: '+17208388296',
            from: '+12017191807',
            body: `Quick! Only a ${item.waitTime} minute wait to ride '${item.name}'`
        });*/
    });
}

function sendLongNotifications(lines) {
    return Bluebird.map(lines.longLines, function (item) {
        console.log(`Bummer, that line for '${item.name}' creeped up again, now it's ${item.waitTime} minutes.`);
        /*return createMessage({
            to: '+17208388296',
            from: '+12017191807',
            body: `Bummer, that line for '${item.name}' creeped up again, now it's ${item.waitTime} minutes.`
        });*/
    });
}

function refreshActive(active) {
    return function (lines) {
        let activeArr = Array.from(active);
        let newActive = activeArr.concat(lines.shortLines.map(function(item) { return item.id; }));
        return new Set(newActive.filter(function(item) {
            return item in lines.longLines;
        }));
    }
}

const getWaitTimes = Bluebird.promisify(magicKingdom.GetWaitTimes);

function loop(notifications, active) {
    getWaitTimes(true)
        .tap(function (waitTimes) {
            console.log(waitTimes.map(JSON.stringify));
        })
        .then(splitWaitTimes(notifications, active))
        .tap(sendShortNotifications)
        .tap(sendLongNotifications)
        .then(refreshActive(active))
        .then(function(newActive) {
            setTimeout(function() {
                loop(notifications, newActive);
            }, 1000 * 60 * 5);
        })
        .catch(function (err) {
            console.error("Error fetching Magic Kingdom wait times: ", err);
        });
}

loop(config.notifications, new Set([]));
