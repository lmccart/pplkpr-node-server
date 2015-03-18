
var express = require('express');
var app = express();
app.set('port', process.env.PORT || 3000);
app.set('view engine', 'jade');

var server = require('http').Server(app);
server.listen(app.get('port'));
console.log('Listening on '+app.get('port'));

var MongoClient = require('mongodb').MongoClient
var assert = require('assert');
var reports;

MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to mongodb");
  reports = db.collection("reports");
});


app.get('/add_report', function (req, res) {
  console.log(req.query);
  var r = {
    name: req.query.name,
    number: req.query.number,
    emotion: req.query.emotion,
    value: parseFloat(req.query.value),
    timestamp: new Date().getTime()
  }

  // Insert some documents
  reports.insert(r, function(err, result) {
    assert.equal(err, null);
    console.log("inserted");
    //callback(result);
  });

  res.send('thanks');
})



app.get('/leader/:emotion', function (req, res) {
  console.log(req.params.emotion);
  res.render('index', { title: req.params.emotion});
})



app.use(express.static(__dirname + '/public'));

