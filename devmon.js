#!/usr/bin/env node

var formidable = require('formidable');

var fs = require('fs');
var child_process = require('child_process');
var forever = require('forever-monitor');
var app = require('./app');

var DEBUG = true;

var devmon_log = function(s) {
    console.log('[Appcubator] ' + s);
};

String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


/* name is used for printing logs.
 * command should be an array of args.
 * watchDirectory is optional, for when you want to watch files. */
var spawn = function (name, command, watchDirectory) {
    var watchObj = watchDirectory ? {watch:true, watchDirectory:'.'} : undefined;
    var child = forever.start(command, watchObj);

    child.on('start', function () { devmon_log(name + ' has started');});
    child.on('exit', function () { devmon_log(name + 'has quit');});
    child.on('restart', function () { devmon_log(name + 'has restarted'); });
};

var spawnFromConfig = function(config) {
    var child;
    if (config.name === 'App')
        child = spawn(config[0], config[1], '.');
    else
        child = spawn(config[0], config[1]);
    return child;
};

/* Each config is an array of [name, prefix, port, webSockFlag] */
var proxyFromConfigs  = function (configs) {
    // TODO setup proxy using http-proxy. do the referer trick.
};

var start = function(appCmd) {
    var spawnConfigs = [];
    var proxyConfigs = [];

    /* initial configs */
    var appConfig = ['App', appCmd];
    spawnConfigs.push(appConfig);
    proxyConfigs.push(['App', null, 3000, false]);

    /* start the devmon web app */
    var webapp = app.listen(4000);
    proxyConfigs.push(['admin', '/appcubator', 4000, false]);

    /* start subprocesses and proxies */
    var spawnChildren = _.map(spawnConfigs, spawnFromConfig);
    var proxyServer = proxyFromConfigs(proxyConfigs);

};
