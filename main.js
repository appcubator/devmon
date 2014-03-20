var fs = require('fs');
var devmon = require('./devmon');
var app = require('./app');
var _ = require('underscore');
var parse = require('shell-quote').parse;

var start = function(spawnConfigs, proxyConfigs) {

    /* global app configs */
    devmon.setGlobal('appSConfig', _.find(spawnConfigs, function(conf) { return conf[0] === 'App'; }));
    devmon.setGlobal('appPConfig', _.find(proxyConfigs, function(conf) { return conf.name === 'App'; }));

    // autoadd for the devmon web app
    proxyConfigs.push({ name: 'admin', domain: 'devmon', port: 4000, webSockFlag: false });

    /* start subprocesses and proxies */
    _.each(spawnConfigs, devmon.spawnFromConfig);
    _.each(proxyConfigs, devmon.configureProxy);
    var proxyServer = devmon.setupDynamicProxyServer(proxyConfigs);

    /* start the devmon web app */
    var webapp = app.createApp(spawnConfigs, proxyConfigs).listen(4000);

    process.once("SIGINT", function () { process.exit(0); });
    process.once("SIGTERM", function () { process.exit(0); });
    process.once("exit", function () {
        _.each(spawnConfigs, function(c) {
            c.child.kill('SIGTERM');
        });
    });

};

if (require.main === module) {
    var file = __dirname + '/config.json';

    fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
          devmon.log('Error: ' + err);
          return;
        }

        var CONFIG = JSON.parse(data);
        devmon.setGlobal('CONFIG', CONFIG);
        _.each(CONFIG.processes, function(sconf) {
            // parse the string commands to arrays of args
            sconf[1] = parse(sconf[1]);
        });

        devmon.log("Loaded configuration from config.json: \n" + JSON.stringify(CONFIG, null, 4));

        var cwd = process.argv[2];
        if (!cwd) {
            devmon.log("Error: please provide working directory as first arg.");
            process.exit(1);
        }
        process.chdir(cwd);
        devmon.log('Changed CWD to ' + cwd);

        start(CONFIG.processes, CONFIG.proxies);
    });
}
