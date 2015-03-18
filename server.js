
var multer = require('multer');
var express = require('express');
var app = express();
app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);
server.listen(app.get('port'));
console.log('Listening on '+app.get('port'));

// CONFIG MONGO
var MongoClient = require('mongodb').MongoClient
var assert = require('assert');
var reports;

MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to mongodb");
  reports = db.collection("reports");
});

// CONFIG MULTER
var uploaded = false;
app.use(multer({ dest: './uploads/',
  rename: function (fieldname, filename) {
    return filename;
  },
  onFileUploadStart: function (file) {
    console.log(file.originalname + ' is starting ...')
  },
  onFileUploadComplete: function (file) {
    console.log(file.fieldname + ' uploaded to  ' + file.path);
  }
}));


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

app.post('/add_person',function(req,res){
  console.log(req.body.name);
  res.send('thanks');
});

app.get('/get_emotion', function (req, res) {
  var e = req.query.emotion;
  res.send({name: n, pic: p}); 
});