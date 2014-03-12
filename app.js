var express = require('express');
var app = express.createServer();

app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.get('/', function(req, res) {
    res.send('Howdy, world?');
});

exports.app = app;
