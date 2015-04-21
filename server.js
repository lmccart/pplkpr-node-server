var latinize = require('latinize');
var aws = require('aws-sdk');
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
var reports, people;

var emotions = ['Angry', 'Calm', 'Bored', 'Excited', 'Aroused', 'Anxious', 'Scared'];
var leaders = {};

MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to mongodb");
  reports = db.collection("reports");
  people = db.collection("people");

  eval_people();
  setInterval(eval_people, 3000);
});

// Load the S3 information from the environment variables.
var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
var S3_BUCKET = process.env.S3_BUCKET

/*
 * Respond to GET requests to /sign_s3.
 * Upon request, return JSON containing the temporarily-signed S3 request and the
 * anticipated URL of the image.
 */
 app.get('/sign_s3', function(req, res){
  aws.config.update({ accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY});
  aws.config.update({ signatureVersion: 'v4', region: 'eu-central-1' });
  var s3 = new aws.S3();
  var s3_params = { 
    Bucket: S3_BUCKET, 
    Key: req.query.s3_object_name, 
    Expires: 60, 
    ContentType: req.query.s3_object_type, 
    ACL: 'public-read'
  }; 
  s3.getSignedUrl('putObject', s3_params, function(err, data){ 
    if(err){ 
      console.log(err); 
    }
    else{ 
      var return_data = {
        signed_request: data,
        url: 'https://'+S3_BUCKET+'.s3.amazonaws.com/'+req.query.s3_object_name 
      };
      res.write(JSON.stringify(return_data));
      res.end();
    } 
  });
});

app.get('/add_report', function (req, res) {
  console.log(req.query);

  // frankfurt, uncomment when live
  // var nw = [50.232890, 8.469555];
  // var se = [49.988496, 8.958446];

  // the whole world
  var nw = [+90, -180];
  var se = [-90, +180];

  if(inside([req.query.lat, req.query.lon], nw, se)) {
    get_person(req.query.name, req.query.number, function(id) {   
      if (id) {
        var r = {
          person: id,
          lat: req.query.lat,
          lon: req.query.lon,
          name: req.query.name,
          number: req.query.number,
          emotion: req.query.emotion,
          value: parseFloat(req.query.value),
          timestamp: new Date().getTime()
        };

        reports.insert(r, function(err, result) {
          assert.equal(err, null);
          console.log('inserted report');
        });
        res.send('successful');
      } else {
        res.send('person not found');
      }
    })
  } else {
    res.send('ignoring report outside bounding box');
  }
})

app.get('/add_person',function(req,res){
  console.log(req.query);
  var p = {
    name: req.query.name,
    number: req.query.number,
    normalized_name: normalize_name(req.query.name),
    normalized_number: normalize_number(req.query.number),
    photo: req.query.photo
  }

  people.insert(p, function(err, result) {
    assert.equal(err, null);
    console.log('inserted person');
    //callback(result);
  });
  res.send('thanks');
});

app.get('/get_leader', function (req, res) {
  var e = req.query.emotion;
  console.log(e);
  if (leaders[e]) {
    console.log(leaders[e]);
    people.findOne({_id: leaders[e]}, function(err, doc) {
      if (doc) res.send(doc);
      else res.send({});
    });
  }
});

app.get('/get_leaders', function (req, res) {
  res.send(leaders);
});

app.get('/normalize', function (req, res) {
  people.find().each(function(err, item) {
    if(item) {
      item.normalized_name = normalize_name(item.name);
      item.normalized_number = normalize_number(item.number);
      people.save(item, function() {});
    }
  });
  res.send('done');
});

function inside(point, nw, se) {
  return point[0] < nw[0] && point[0] > se[0] &&
    point[1] > nw[1] && point[1] < se[1];
}

var carefulMatch = false;
function normalize_name(name) {
  name = latinize(name); // remove diacritics
  name = name.toLowerCase(); // convert to lowercase
  if(!carefulMatch) name = name.replace(/\s.+\s/g, ''); // remove middle names
  name = name.replace(/\s/g, ''); // remove remaining spaces
  if(!carefulMatch) name = name.replace(/[aeiou]/g, ''); // remove vowels
  return name;
}

function normalize_number(number) {
  if(carefulMatch) {
    number = number.replace(/[^+\d]+/g, ' '); // replace consecutive non-numbers besides + with single spaces
    number = number.trim(); // remove whitespace at ends
    number = number.replace(/^(\+|00|011|010|0011)\D*\d{1,3}\s+/g, ''); // remove international call prefix (+, 00, 011, 010, 0011) followed by country code
    number = number.replace(/\D/g, ''); // remove remaining non-numbers
  } else {
    number = number.replace(/\D/g, ''); // remove all non-numbers
    number = number.slice(-7); // take the last 7 digits
  }
  return number;
}

function get_person(name, number, cb) {
  // first match the name
  var normalized_name = normalize_name(name);
  people.findOne({normalized_name: normalized_name}, function(err, doc) {
    if (doc) cb(doc._id);
    else {
      // then match the number if it's not an empty string
      if (number.length) {
        var normalized_number = normalize_number(number);
        people.findOne({normalized_number: normalized_number}, function(err, doc) {
          if (doc) cb(doc._id);
          else cb();
        });
      } else {
        cb();
      }
    }
  });
}

function eval_people() {
  // for each emotion find maxs, store somehow
  emotions.forEach(function(e, ind) {
    var scores = {};
    var people = [];

    reports.find({emotion: e}).toArray(function(err, docs) {
      // first add up all vals and track unique people
      for (var j=0; j<docs.length; j++) {
        var p = docs[j].person;
        if (!scores[p]) {
          scores[p] = docs[j].value;
          people.push(p);
        } else {
          scores[p] += docs[j].value;
        }
      }
      // sort people list
      people.sort(function(a, b) { return scores[b] > scores[a] ? 1 : -1; });

      // set leader
      leaders[e] = people.length > 0 ? people[0] : null;
    });   
  });
}