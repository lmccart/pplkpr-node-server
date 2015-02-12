
var express = require('express');
var app = express();
app.set('port', process.env.PORT || 3000);

var server = require('http').Server(app);
var io = require('socket.io')(server);
server.listen(app.get('port'));

var socket;
var hr = 0;


io.on('connection', function (socket) {
  socket = socket;
  console.log('socket connected');
});

// app.get('/', function (req, res) {
//   res.sendfile(__dirname + '/public/index.html');
// })

//app.use(express.static('public'));


app.get('/update_hr', function (req, res) {
  console.log(req.query);
  hr = parseInt(req.query.hr, 10);
  console.log(hr);
  if (socket) socket.broadcast.emit('hr', hr);
  res.send('thanks');
})


app.use(express.static(__dirname + '/public'));


// var server = app.listen(app.get('port'), function () {
//   console.log('Example app listening at http://%s:%s', server.address().address, server.address().port);
// });