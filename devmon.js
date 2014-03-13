#!/usr/bin/env node

var formidable = require('formidable');

var fs = require('fs');
var child_process = require('child_process');
var forever = require('forever-monitor');
var connect = require('connect');
var httpProxy = require('http-proxy');
var app = require('./app');
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
var spawn = function (name, command, watchDirectory) {
    var watchObj = watchDirectory ? {watch:true, watchDirectory:'.'} : {};
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

/* If host matches a config host, return the config.
 * Otherwise return the app config. */
var hostToConfig = function(host, configs) {
    var config, i, matched = false;
    for (i = 0; i < configs.length; i ++) {
        config = configs[i];

        // config.domain is null. don't match this, it's prolly appPConfig, which is the fallback in case nothing else is found
        if (!config.domain)
            continue;

        if (host.toLowerCase().startsWith(config.domain.toLowerCase())) {
            matched = true;
            break;
        }
    }

    if (!matched)
        config = appPConfig;
    return config;
};

/* Each config is an obj with keys [name, domain, port, webSockFlag] */
var proxyFromConfigs  = function (configs) {
    var proxies = {}; // name -> httpProxy object
    _.each(configs, function(config) {
        var proxy = httpProxy.createProxyServer({
            target: 'http://localhost:' + config.port
        });

        proxies[config.name] = proxy;
    });

    var proxyServer = connect.createServer(
        // Host based routing
        function (req, res, next) {
            var host = req.headers.host;
            var config = hostToConfig(host, configs);
            devmon_log('Incoming http request host \'' + host + '\' matched \'' + config.name +'\', routing to :' + config.port);
            proxies[config.name].web(req, res);
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
            proxies[config.name].ws(req, socket, head);
        }
    });

    proxyServer.on('error', function (i) {
        console.log('NOOOOOO');
    });
};

var appSConfig, appPConfig, CONFIG;

var start = function(spawnConfigs, proxyConfigs) {

    /* global app configs */
    appSConfig = _.find(spawnConfigs, function(conf) { return conf[0] === 'App'; });
    appPConfig = _.find(proxyConfigs, function(conf) { return conf.name === 'App'; });

    /* start the devmon web app */
    var webapp = app.app.listen(4000);
    proxyConfigs.push({ name: 'admin', domain: 'devmon', port: 4000, webSockFlag: false });

    /* start subprocesses and proxies */
    var spawnChildren = _.map(spawnConfigs, spawnFromConfig);
    var proxyServer = proxyFromConfigs(proxyConfigs);

};

if (require.main === module) {
    var file = __dirname + '/devmon.json';

    fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
          devmon_log('Error: ' + err);
          return;
        }

        CONFIG = JSON.parse(data);
        var parse = require('shell-quote').parse;
        _.each(CONFIG.processes, function(sconf) {
            // parse the string commands to arrays of args
            sconf[1] = parse(sconf[1]);
        });

        devmon_log("Loaded configuration from devmon.json: \n" + JSON.stringify(CONFIG, null, 4));
        start(CONFIG.processes, CONFIG.proxies);
    });
}
