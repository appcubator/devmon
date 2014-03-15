var connect = require('connect');

var s = connect.createServer();

s.use('/', function (req, res, next) {
      res.end("New kid on the block.");
});

s.listen(process.env.PORT || 3000);
