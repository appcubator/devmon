#!/usr/bin/env node

var formidable = require('formidable');

var fs = require('fs');
var child_process = require('child_process');
var forever = require('forever-monitor');
var connect = require('connect')
var httpProxy = require('../../lib/http-proxy');
var app = require('./app');

var DEBUG = true;
var PORT = process.env.PORT || 5000;

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

/* Each config is an obj with keys [name, prefix, port, webSockFlag] */
var proxyFromConfigs  = function (configs) {
    // TODO setup proxy using http-proxy. do the referer trick.
    var proxies = {}; // name -> proxy

    connect.createServer(
        // Referer based url-rewriting trick.
        function(req, res, next) {
            var config, i;
            for (i = 0; i < configs.length; i ++) {
                config = configs[i];
                if (req.headers.referer && req.headers.referer.endsWith(config.prefix)) {
                    // this request came from a matched prefix
                    if (req.url.indexOf(config.prefix) !== 0)
                        req.url = config.prefix + req.url;
                    break;
                }
            }
            next();
        },
        // URL prefix matching
        function (req, res) {
            var config, i, matched = false;
            for (i = 0; i < configs.length; i ++) {
                config = configs[i];
                if (req.url.startsWith(config.prefix)) {
                    req.url.replace(config.prefix, '/');
                    matched = true;
                    break;
                }
            }

            if (!matched)
                config = appConfig;

            proxies[config.name].web(req, res);
        }
    ).listen(PORT);

    _.each(configs, function(config) {
        var proxy = httpProxy.createProxyServer({
            target: 'http://localhost:' + config.port
        });

        proxies[config.name] = proxy;

        if (config.webSocketFlag) {
            // Listen to the `upgrade` event and proxy the 
            // WebSocket requests as well.
            //
            proxyServer.on('upgrade', function (req, socket, head) {
                proxy.ws(req, socket, head);
            });
        }
    });
};

var start = function(appCmd) {
    var spawnConfigs = [];
    var proxyConfigs = [];

    /* initial configs */
    appConfig = ['App', appCmd];
    spawnConfigs.push(appConfig);
    proxyConfigs.push(['App', null, 3000, false]);

    /* start the devmon web app */
    var webapp = app.listen(4000);
    proxyConfigs.push(['admin', '/appcubator', 4000, false]);

    /* start subprocesses and proxies */
    var spawnChildren = _.map(spawnConfigs, spawnFromConfig);
    var proxyServer = proxyFromConfigs(proxyConfigs);

};
