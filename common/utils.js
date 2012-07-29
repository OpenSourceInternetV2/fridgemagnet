var http = require('http');
var https = require('https');
var zlib = require('zlib');

var _ = require('./config.js').main;


exports.argv = function (n, a, o) {
  a.splice(0, 2);

  if(a.indexOf('-h') != -1 ||
     a.indexOf('--help') != -1) {
       console.log(n, '\n-h --help \t print usage');

       for(var i in o)
         console.log(i, '\t\t', o[i].d);
    return;
  }

  for(var i in o) {
    var e = a.indexOf(i);
    if(e == -1) {
      o[i] = null;
      continue;
    }

    if(o[i].b) {
      o[i] = true;
      a.splice(e, 1);
    }
    else {
      o[i] = a[e+1];
      a.splice(e, 2);
    }
  }

  return o;
}


exports.host = function (host) {
  host = host.split('\.');

  var ext = '';
  while(host[host.length-1].length <= 3 && host.length >= 2)
    ext = host.splice(host.length-1, 1)[0] + '.' + ext;

  if(host.length >= 2)
    host = host.splice(1, host.length).join('.');
  else
    host = host[0];

  if(!ext.length)
    return host;

  return host + '.' + ext.substr(0, ext.length-1);
}


exports.get = function (o, success, error, redir) {
  if(!redir)
    redir = error;

  if(!o.headers)
    o.headers = {};
  o.headers['accept-encoding'] = 'gzip';

  var isTorrent = false;
  var rq = ((o.protocol == 'https:') ? https : http).get(o, function (r) {
    if(r.statusCode && r.statusCode != 200) {
      if(r.statusCode >= 400)
        error(r.statusCode);
      else (r.statusCode >= 300)
        redir(r.headers.location);
      return;
    }

    var ct = r.headers['content-type'];
    if(ct && (ct == 'application/x-bittorrent'))
      isTorrent = true;
    else if(!ct || ct.search(/html/i) == -1) {
      rq.end();
      error();
      return;
    }


    var body = [];
    var pipe;
    if(r.headers['content-encoding'] == 'gzip') {
      pipe = zlib.createGunzip();
      r.pipe(pipe);
    }
    else
      pipe = r;

    pipe
      .on('data', function (d) { body.push(d); })
      .on('end', function () {
          if(body.length)
            body = Buffer.concat(body);
          success(body, isTorrent);
      })
      .on('error', function () {
          error();
      });
  })
  .on('error', function (e) {
      error();
  });

  return rq;
}



exports.log = function () {};
if(_.log)
  exports.log = function(v) { console.log(v.substr(0, 80)); }

