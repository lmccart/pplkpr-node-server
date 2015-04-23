var latinize = require('latinize');
var aws = require('aws-sdk');
var express = require('express');
var app = express();
app.enable('trust proxy');
app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);
server.listen(app.get('port'));
console.log('Listening on '+app.get('port'));

// CONFIG MONGO
var MongoClient = require('mongodb').MongoClient;
var reports, people;

var emotions = ['Angry', 'Calm', 'Bored', 'Excited', 'Aroused', 'Anxious', 'Scared'];
var leaders = {};

MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
  if (err) throw err;
  console.log('Connected correctly to mongodb');
  reports = db.collection('reports');
  people = db.collection('people');

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
    if(err) { 
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
  // frankfurt
  var nw = [50.232890, 8.469555];
  var se = [49.988496, 8.958446];
  var report = {
    inside: inside([req.query.lat, req.query.lon], nw, se),
    lat: req.query.lat,
    lon: req.query.lon,
    name: req.query.name,
    number: req.query.number,
    emotion: req.query.emotion,
    value: parseFloat(req.query.value),
    timestamp: new Date().getTime(),
    ip: req.ip
  };
  get_person(req.query.name, req.query.number, function(person) {
    report.person = person;
    reports.insert(report,
      function (err, result) {
        if (err) console.log(err);
        console.log('added report');
        res.send(result);
      }
    )
  })
})

// endpoint for testing normalize_name function
app.get('/normalize_name', function(req,res){
  res.send(normalize_name(req.query.name));
})

// endpoint for testing normalize_number function
app.get('/normalize_number', function(req,res){
  res.send(normalize_number(req.query.number));
})

app.get('/add_person',function(req,res){
  var normalized_name = normalize_name(req.query.name);
  var normalized_number = normalize_number(req.query.number);
  var result = people.update(
    {
      normalized_name: normalized_name,
      normalized_number: normalized_number
    },
    {
      normalized_name: normalized_name,
      normalized_number: normalized_number,
      name: req.query.name,
      number: req.query.number,
      photo: req.query.photo,
      timestamp: new Date().getTime()
    },
    {
      upsert: true
    },
    function (err, result) {
      if (err) console.log(err);
      console.log('added person');
      res.sendStatus(result);
      update_reports();
    }
  );
});

app.get('/get_leader', function (req, res) {
  var e = req.query.emotion;
  if (leaders[e]) {
    people.findOne({_id: leaders[e]}, function(err, doc) {
      if (doc) res.send(doc);
      else res.send({});
    });
  } else {
    res.send({});
  }
});

app.get('/get_leaders', function (req, res) {
  res.send(leaders);
});

var showNumbers = false;
app.get('/get_reports', function (req, res) {
  var fields = {_id:0, person:1, name:1, emotion:1, value:1, lat:1, lon:1, timestamp:1};
  if(showNumbers) {
    fields.number = 1;
  }
  reports.find({}, fields).toArray(function(err, all) {
    res.json(all);
  });
});

app.get('/get_people', function (req, res) {
  var fields = {name:1, normalized_name:1, photo:1, timestamp:1};
  if(showNumbers) {
    fields.number = 1;
    fields.normalized_number = 1;
  }
  people.find({}, fields).toArray(function(err, all) {
    res.json(all);
  });
});

// this endpoint builds normalized names and numbers for all people.
app.get('/normalize', function (req, res) {
  people.find().each(function(err, item) {
    if(item) {
      item.normalized_name = normalize_name(item.name);
      item.normalized_number = normalize_number(item.number);
      people.save(item, function() {});
    }
  });
  res.send('done normalizing people');
});

app.get('/update_reports', function (req, res) {
  update_reports();
  res.send('updated');
})

function inside(point, nw, se) {
  return point[0] < nw[0] && point[0] > se[0] &&
    point[1] > nw[1] && point[1] < se[1];
}

// if we are matching people that are actually different people,
// set this flag to 'true' and then hit the /normalize endpoint
var carefulMatch = false;
function normalize_name(name) {
  if(!name) return '';
  name = latinize(name); // remove diacritics
  name = name.toLowerCase(); // convert to lowercase
  if(!carefulMatch) name = name.replace(/\s.+\s/g, ''); // remove middle names
  name = name.replace(/\s/g, ''); // remove remaining spaces
  if(!carefulMatch) name = name.replace(/[aeiou]/g, ''); // remove vowels
  return name;
}

function normalize_number(number) {
  if(!number) return '';
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

// tries to update all reports will person: null
function update_reports() {
  reports.find({person: null}).each(function(err, report) {
    if(report) {
      get_person(report.name, report.number, function(person) {
        if(person) {
          report.person = person;
          reports.save(report, function() {});
          console.log('updated report for ' + report.name + ' with ' + person)
        }
      })
    }
  });
}

// returns a document id if the person is found. otherwise, null
function get_person(name, number, cb) {
  // first try to match the name
  var normalized_name = normalize_name(name);
  if(normalized_name.length) {
    people.findOne({normalized_name: normalized_name}, function(err, doc) {
      if (doc) cb(doc._id);
      else {
        // then try to match the number if it's not an empty string
        var normalized_number = normalize_number(number);
        if (normalized_number.length) {
          people.findOne({normalized_number: normalized_number}, function(err, doc) {
            if (doc) cb(doc._id);
            else cb(null);
          });
        } else {
          cb(null);
        }
      }
    })
  }
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
        if(p) {
          if (!scores[p]) {
            scores[p] = docs[j].value;
            people.push(p);
          } else {
            scores[p] += docs[j].value;
          }
        }
      }
      // sort people list
      people.sort(function(a, b) { return scores[b] > scores[a] ? 1 : -1; });

      // set leader
      leaders[e] = people.length > 0 ? people[0] : null;
    });   
  });
}