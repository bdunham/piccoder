/******************************************************************************

PicCoder - A Node.JS image processing server in the style of Zencoder

Example request:
{
  "input": { "bucket": SRC_S3_BUCKET, "key": SRC_S3_KEY },
  "outputs": [{
    "bucket": DEST_S3_BUCKET,
    "key": DEST_S3_KEY,
    "mode": MODE,
    "width": WIDTH,
    "height": HEIGHT,
    "notification": OUTPUT_URL
  }, {
    "bucket": DEST_S3_BUCKET,
    "key": DEST_S3_KEY,
    "mode": MODE,
    "width": WIDTH,
    "height": HEIGHT,
    "notification": OUTPUT_URL
  }]
}

Definitions
==
SRC_S3_BUCKET     Name of S3 Bucket that contains the source file
SRC_S3_KEY        Filename and path of source file e.g. /foldername/filename.mp3
DEST_S3_BUCKET    Name of the S3 Bucket which the content is being sent to
DEST_S3_KEY       Filename and path of file to create on S3 e.g. /foldername/filename_small.jpg
OUTPUT_URL        URL of notification endpoint, hit with HTTP POST when Output completed
MODE              Resizing mode: scale = proportional resize, 
                                 crop = exact size image cropped vertically or horizontally
                                 thumb = exact size image, no cropping, padded with solid colour
WIDTH             Width in pixels of output image
HEIGHT            Height in pixels of output image

Credentials (stored in creditals.json)
==
{ "accessKeyId": "xxx", "secretAccessKey": "xxx", "region": "eu-west-1" }

*******************************************************************************/

var AWS = require('aws-sdk');
AWS.config.loadFromPath('./credentials.json');

var http = require('http');
var s3 = new AWS.S3();
var querystring = require('querystring');
var url = require('url');
var fs = require('fs');
var im = require('imagemagick');
var async = require('async');

var queue = new Array();
var locked = false;

var bind_ip = '0.0.0.0';
var bind_port = 8081;

var job;

http.createServer(function (req, res) {

  var fullBody = '';

  req.on('data', function(chunk) {
    fullBody += chunk.toString();
  });

  req.on('end', function() {
    res.writeHead(200, "OK", {'Content-Type': 'text/html'});
    queue[queue.length] = JSON.parse(fullBody);
    console.log('Added (' + queue[queue.length - 1].input.key + ') to queue');
    processQueueItem();
    res.end();
    
    fullBody = '';
  });
}).listen(bind_port, bind_ip);


function processQueueItem() {
  if (queue.length == 0 || locked) return false;
  locked = true;
  job = queue.shift();
  s3.client.getObject({ Bucket: job.input.bucket, Key: job.input.key }, function(err, data) {
    if (err) { console.log(err); return false; }

    var srcFile = 'tmp/test.jpg';
    fs.writeFile(srcFile, data.Body, function(e) {
      
      var tasks = [];
      for (var i=0; i<job.outputs.length; i++)
      {
        tasks.push(function(callback){
          resizeImage(srcFile, callback);
        });
      }
      var fileData = null;
      tasks.push(function(callback){
        im.identify(srcFile, function(err, features){
          fileData = features;
          callback(null, 'metadata');
        });
      });
      async.series(tasks, function(err, results){
        if (job.notification)
        {
          var u = url.parse(job.notification);
          var req = http.request({ hostname: u.hostname, port: u.port, path: u.path, method: 'POST' }, function(res) {
            res.setEncoding('utf8');
          });
          req.on('error', function(e) {
            console.log('Couldnt notify: ' + e.message);
          });
          
          req.write(JSON.stringify(fileData));
          req.end();
          console.log("Sent notification to " + job.notification);
        }
        
        locked = false;
        processQueueItem();
      });
    });
  });
}

function resizeImage(srcFile, callback)
{
  console.log('Resizing');
  output = job.outputs.shift();
  var dstFile = 'tmp/resized.jpg';
  var params = null;
  switch (output.mode)
  {
    case 'scale':
      params = [srcFile, '-resize', output.width + 'x' + output.height, dstFile]; break;
      
    case 'crop':
      params = [srcFile, '-resize', output.width + 'x' + output.height + '^', '-gravity', 'center', '-extent', output.width + 'x' + output.height, dstFile]; break;
      
    case 'thumb':
      params = [srcFile, '-resize', output.width + 'x' + output.height, '-gravity','center', '-background', 'white', '-extent', output.width + 'x' + output.height, dstFile]; break;
  }
  im.convert(params, function(err, stdout){
    if (err) throw err;
    var stream = fs.createReadStream(dstFile);
    stream.on("open", function(){
      s3.client.putObject({ Bucket: output.bucket, Key: output.key, Body: stream }, function(err, data){
        if (err) throw err;
        fs.stat(dstFile, function(err, stats){
          if (err) throw err;
        
          if (output.notification)
          {
             var u = url.parse(output.notification);
             var req = http.request({ hostname: u.hostname, port: u.port, path: u.path, method: 'POST' }, function(res) {
               res.setEncoding('utf8');
             });
             req.on('error', function(e) {
               console.log('Couldnt notify: ' + e.message);
             });
             req.write(JSON.stringify(
               {
                 bucket: output.bucket,
                 key: output.key,
                 size: stats.size
               }
             ));
             req.end();
          }
          callback(null, output.key);
        });
      });
    });
  });
}

console.log('Server running at http://' + bind_ip + ':' + bind_port + '/');
