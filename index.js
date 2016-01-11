"use strict";

var kafka = require('kafka-node');

var Disney = require("wdwjs");
var disneyApi = new Disney({timeFormat: "HH:mm"});

var magicKingdom = disneyApi.MagicKingdom;

var Producer = kafka.Producer;
var client = new kafka.Client("localhost:2181");
var producer = new Producer(client);

producer.on("ready", function() {
    magicKingdom.GetWaitTimes(true, function (err, waitTimes) {
        if(err) {
            return console.error("Error fetching Magic Kingdom wait times: ", err);
        }

        console.log(waitTimes.map(JSON.stringify));
        producer.send(
            [{topic: "wait-time", messages: waitTimes.map(JSON.stringify)}],
            function(err, result) {
                console.log(err || result);
                process.exit();
            }
        );
    });
});
