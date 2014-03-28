var express = require('express');
var fs = require('fs');
var child_process = require('child_process');
var devmon = require('./devmon');
var _ = require('underscore');


var updateCode = function (tarpath, callback) {
    child_process.exec('tar -xvf '+tarpath, function(err, stdout, stderr) {
        if (err) devmon.log(err);
        else {
            devmon.log('Code updated. Tar output:');
            devmon.log(stdout);
            devmon.log(stderr);
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

    /* Process spawning */
    // get the entire spawn config
    app.get('/conf/spawn', function(req, res) {
       res.send(['<html>',
                   '<body>',
                     '<div>',
                       '<h2>Terminate a process</h2>',
                       _.map(spawnConfigs, function(s) {
                          var scopy = _.clone(s);
                          delete scopy.child;
                          return ['<div>',
                                     '<div>' + JSON.stringify(scopy, null, 2) + '</div>',
                                     '<form method="POST" action="/conf/spawn/' + (s.child.data.pid || '').toString() + '/remove">',
                                       '<input type="submit" value="Kill">',
                                     '</form>',
                                   '</div>'].join('\n');
                       }).join('\n'),
                     '</div>',
                     '<div>',
                       '<h2>Spawn a new process</h2>',
                       '<form method="POST" action="/conf/spawn/create">',
                       '<textarea name="conf"></textarea>',
                       '<input type="submit" value="create">',
                       '</form>',
                     '</div>',
                   '</body>',
                 '</html>'
       ].join('\n'));
    });

    // kill a process and remove the config entry
    app.post('/conf/spawn/:pid/remove', function(req, res) {
        var spawnConf = _.find(spawnConfigs, function(c) { return c.child.data.pid === parseInt(req.params.pid); });
	if (spawnConf === undefined) {
            var pidstr = _.map(spawnConfigs, function(c) { return c.child.data.pid.toString(); }).join(' ');
            res.status(404).send('ruh roh. here are valid pids '+ pidstr);
        } else {
            spawnConf.child.kill(true); // prevents restarting
            spawnConf.child.restart = function() {}; // TODO FIXME DIRTY HACK to address a file-watcher bug where it does not de-register stopped apps.
            res.redirect('/conf/spawn');
        }
    });

    // create a new process config entry and spawn it. send {conf: [...]}
    app.post('/conf/spawn/create', function(req, res) {
        var conf = JSON.parse(req.body.conf);
        devmon.spawnFromConfig(conf, spawnConfigs);
        spawnConfigs.push(conf);
        res.redirect('/conf/spawn');
    });

    /* Proxy configuration */
    // get the entire proxy [{}] config
    app.get('/conf/proxy', function(req, res) {
        res.json(_.map(proxyConfigs, function(c) { var d = _.clone(c); delete d.proxy; return d; }));
    });

    // update the entire proxy [{}] config
    app.post('/conf/proxy/update', function(req, res) {
        var conf = req.body.conf;
        while (proxyConfigs.length > 0) {
            proxyConfigs.pop();
        }
        while (conf.length !== 0) {
            proxyConfigs.push(conf.pop(0));
        }
        res.send('ok');
    });

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
