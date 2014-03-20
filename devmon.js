#!/usr/bin/env node

var fs = require('fs');
//var path = require('path');
var child_process = require('child_process');
var forever = require('forever-monitor');
var connect = require('connect');
var httpProxy = require('http-proxy');
var _ = require('underscore');

var DEBUG = true;
var PORT = process.env.PORT || 5000;

var devmon_log = function(s) {
    console.log('[Appcubator] ' + s);
};

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
};


/* name is used for printing logs.
 * command should be an array of args.
 * watchDirectory is optional, for when you want to watch files. */
var spawn = function (name, command, watchDirectory, env, cwd, options) {
    options = options || {};
    if (env) options.env=env;
    if (cwd) options.cwd=cwd;

    if (watchDirectory) {
        options.watch = true;
        options.watchDirectory = watchDirectory;
    }

    options.minUptime = 2*1000;      // If app can't stand on it's feet for 2 seconds,
    options.spinSleepTime = 5*1000; //   wait 5 seconds before restarting.

    options.outFile = '/tmp/' + name + '-out.log'; // Path to log output from child stdout
    options.errFile = '/tmp/' + name + '-err.log'; // Path to log output from child stderr

    var child = forever.start(command, options);

    child.on('start', function () { devmon_log(name + ' has started');});
    child.on('exit', function () { devmon_log(name + ' has quit');});
    child.on('restart', function () { devmon_log(name + ' has restarted'); });
    child.on('error', function (err) { devmon_log(name + ' had an error: ' + err.toString()); });
    return child;
};

var spawnFromConfig = function(config) {
    var child;
    if (config[0] === 'App')
        child = spawn(config[0], config[1], '.');
    else
        child = spawn(config[0], config[1]);
    config.child = child;
};

/* If host matches a config host, return the config.
 * Otherwise return the app config. */
var hostToConfig = function(host, configs) {
    var config, i, matched = false;
    for (i = 0; i < configs.length; i ++) {
        config = configs[i];

        // config.domain is null. don't match this, it's prolly appPConfig, which is the fallback in case nothing else is found
        if (!config.domain)
            continue;

        if (host.toLowerCase().startsWith(config.domain.toLowerCase() + '.')) {
            matched = true;
            break;
        }
    }

    if (!matched)
        config = appPConfig;
    return config;
};

var configureProxy = function(config) {
    var proxy = httpProxy.createProxyServer({
        target: 'http://localhost:' + config.port
    });

    config.proxy = proxy;
};

/* Each config is an obj with keys [name, domain, port, webSockFlag] */
var setupDynamicProxyServer  = function (configs) {

    var proxyServer = connect.createServer(
        // Host based routing
        function (req, res, next) {
            var host = req.headers.host;
            var config = hostToConfig(host, configs);
            devmon_log('Incoming http request host \'' + host + '\' matched \'' + config.name +'\', routing to :' + config.port);
            config.proxy.web(req, res, function (err, req, res) {
                res.writeHead(500, {
                  'Content-Type': 'text/plain'
                });
                res.end('The backend \'' + config.name + '\' is down. Please see the logs.');
            });
        }
    ).listen(PORT);

    proxyServer.on('upgrade', function (req, socket, head) {
        // Listen to the `upgrade` event and proxy the
        // WebSocket requests as well.
        //
        var host = req.headers.host;
        var config = hostToConfig(host, configs);
        if (config.webSockFlag) {
            devmon_log('Incoming ws request host \'' + host + '\' matched \'' + config.name +'\', routing to :' + config.port);
            config.proxy.ws(req, socket, head);
        }
    });

    proxyServer.on('error', function (i) {
        console.log('NOOOOOO');
    });

    return proxyServer;
};

/* Yes this is bad code, resulting from a forced refactor. */
var appSConfig, appPConfig, CONFIG;
exports.setGlobal = function (name, val) {
    if (name === 'appSConfig')
        appSConfig = val;
    else if (name === 'appPConfig')
        appPConfig = val;
    else if (name === 'CONFIG')
        CONFIG = val;
    else
        throw 'wat';
};
exports.log = devmon_log;
exports.spawnFromConfig = spawnFromConfig;
exports.configureProxy = configureProxy;
exports.setupDynamicProxyServer = setupDynamicProxyServer;
