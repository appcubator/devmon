#!/usr/bin/env node

var formidable = require('formidable');

var fs = require('fs');
var child_process = require('child_process');
var forever = require('forever-monitor');
var connect = require('connect');
var httpProxy = require('http-proxy');
var app = require('./app');
var _ = require('underscore');
var jsInsert = require('./wsClientHack').jsInsert;

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

/* Each config is an obj with keys [name, prefix, port, webSockFlag] */
var proxyFromConfigs  = function (configs) {
    var proxies = {}; // name -> httpProxy object

    var proxyServer = connect.createServer(
        // Referer based url-rewriting trick.
        function(req, res, next) {
            var config, i;
            for (i = 0; i < configs.length; i ++) {
                config = configs[i];

                // falsy prefix means root config, no rewriting necessary.
                if (!config.prefix)
                    continue;

                // TODO FIXME fix this to do some parsing... The base url should start with prefix.
                if (req.headers.referer) {
                    // example referer: 'http://127.0.0.1:5000/inspect/debug?port=5858'
                    var referer = req.headers.referer;
                    var _ref_no_protocol = referer.slice(referer.indexOf('://') + 3);
                    var urlTail = _ref_no_protocol.slice(_ref_no_protocol.indexOf('/'));

                    if (urlTail.startsWith(config.prefix)) {
                        // This request came from a page we proxied
                        // If the URL isn't going towards the same proxy, modify it so that it will.

                        if (!req.url.startsWith(config.prefix)) {
                            var oldUrl = req.url;
                            req.url = config.prefix + req.url.slice(1);
                            devmon_log("Rewriting URL from '" + oldUrl + "' to '" + req.url + "'");
                        }

                        break;
                    }
                }
            }
            next();
        },
        // URL prefix matching
        function (req, res, next) {
            var config, i, matched = false;
            var oldUrl = req.url;
            for (i = 0; i < configs.length; i ++) {
                config = configs[i];

                // falsy prefix means root config, routing is N/A.
                if (!config.prefix)
                    continue;

                if (req.url.startsWith(config.prefix)) {
                    req.url = req.url.replace(config.prefix, '/');
                    matched = true;
                    break;
                }
            }

            if (!matched)
                config = appPConfig;
            req.__config = config; // for the next middleware.

            devmon_log('Incoming request url \'' + oldUrl + '\' matched \'' + config.name +'\', routing to :' + config.port);
            next();
        },
        /* If webSockFlag, modify response html to monkeypatch WebSocket constructor to fix the clients ws URL. (hack) */
        function (req, res, next) {
            var config = req.__config;
            if (config.webSockFlag) {

                var _write = res.write;
                var insertion = "<script type=\"text/javascript\">(" + jsInsert.toString() + ")("+JSON.stringify(config.prefix)+");</script>";

                var _setHeader = res.setHeader;
                var isHTML = null; // null if not yet known, otherwise true/false.
                var oldcl = null; // null if not yet known, otherwise an int.
                var newcl = null; // null if not yet known, otherwise an int.
                res.setHeader = function(name, value) {

                    if (name.toLowerCase() === 'content-length') {
                        var contentlength = value;
                        if (contentlength) {
                            contentlength = parseInt(contentlength);
                            oldcl = contentlength;
                        }
                        contentlength += insertion.length;
                        newcl = contentlength;
                        if (isHTML) // case where content-type happened first.
                            value = contentlength.toString();
                    }

                    if (name.toLowerCase() === 'content-type') {
                        if (value.indexOf('text/html') !== -1) {
                            isHTML = true;
                            if (oldcl !== null) {// case where content-length happened first.
                                newcl = oldcl + insertion.length;
                                _setHeader.call(res, 'content-length', newcl); // update the value of content-length
                            }
                        } else {
                            isHTML = false;
                        }
                    }
                    _setHeader.call(res, name, value);
                };

                res.write = function (data) {
                    if (isHTML) {
                        data = data.toString().replace("<head>", "<head>" + insertion);
                        devmon_log('MODIFYING '+ req.url);
                    }
                    _write.call(res, data.toString());
                };
            }
            next();
        },
        function (req, res) {
            var config = req.__config;
            proxies[config.name].web(req, res);
        }
    ).listen(PORT);

    _.each(configs, function(config) {
        var proxy = httpProxy.createProxyServer({
            target: 'http://localhost:' + config.port
        });

        proxies[config.name] = proxy;

        if (config.webSockFlag) {
            // Listen to the `upgrade` event and proxy the 
            // WebSocket requests as well.
            //
            proxyServer.on('upgrade', function (req, socket, head) {
                if (req.url.startsWith(config.prefix)) {
                    req.url = req.url.replace(config.prefix, '/');
                }
                console.log('ZINGGGGGGGGGG');
                var proxy = proxies[config.name];
                proxy.ws(req, socket, head);
            });
            proxyServer.on('error', function (i) {
                console.log('NOOOOOO');
            });
        }
    });
};

var appSConfig, appPConfig, CONFIG;

var start = function(spawnConfigs, proxyConfigs) {

    /* global app configs */
    appSConfig = _.find(spawnConfigs, function(conf) { return conf[0] === 'App'; });
    appPConfig = _.find(proxyConfigs, function(conf) { return conf.name === 'App'; });

    /* start the devmon web app */
    var webapp = app.app.listen(4000);
    proxyConfigs.push({ name: 'admin', prefix: '/appcubator/', port: 4000, webSockFlag: false });

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
