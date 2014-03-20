var express = require('express');
var fs = require('fs');
var child_process = require('child_process');


// copy pasted TODO make dry
var devmon_log = function(s) {
    console.log('[Appcubator] ' + s);
};

var updateCode = function (tarpath, callback) {
    child_process.exec('tar -xvf '+tarpath, function(err, stdout, stderr) {
        if (err) devmon_log(err);
        else {
            devmon_log('Code updated. Tar output:');
            devmon_log(stdout);
            devmon_log(stderr);
            callback();
        }
    });
};

var createApp = function (spawnConfigs, proxyConfigs) {
    var app = express();
    app.configure(function(){
      app.use(express.bodyParser());
      app.use(express.methodOverride());
      app.use(app.router);
    });

    app.get('/', function(req, res) {
        res.send('Devmon configuration panel goes here.');
    });

    // kill a process and remove the config entry
    app.post('/conf/spawn/:pid/remove', function(req, res) {
        var spawnConf = _.find(spawnConfigs, function(c) { return c.child.pid === req.params.pid });
        spawnConf.child.kill('SIGINT');
        spawnConf.child.disconnect();
        // Find and remove item from an array
        var i = spawnConfigs.indexOf(spawnConf);
        if(i != -1) {
            spawnConfigs.splice(i, 1);
        }
    });

    // create a new process config entry and spawn it
    app.post('/conf/spawn/create', function(req, res) {
    });

    // update the entire proxy [{}] config
    app.post('/conf/proxy/update', function() {});

    /* Route to write out files to the FS.
     * Relies on forever-monitor to be watching and restart the app. */
    app.post('/__update_code__', function(req, res) {
        /* [ ROUTE ] update code */
        fs.readFile(req.files.code.path, function (err, data) {
            if(err) throw err;
            var newPath = "code.tar";
            fs.writeFile(newPath, data, function (err) {
                if(err) throw err;
                updateCode(newPath, function(){
                    res.send('OK');
                });
            });
        });
    });

    app.get('/__ping__', function(req, res) {
        res.send('OK');
    });
    return app;
};

exports.createApp = createApp;

if (require.main === module) {
    var webapp = createApp([], []).listen(4000);
}
