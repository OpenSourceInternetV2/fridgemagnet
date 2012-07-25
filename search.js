/*
fridgemagnet: nodejs magnet search engine tools
Copyright (C) 2012 - Thomas Baquet <me lordblackfox net>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/* API (using get methode)
 *  /search/?q=[QUERY]&s=[LIMIT]              make search
 *  /stats                                    get server's stats
 *
 */

var http = require('http');
var dgram = require('dgram');
var qr = require('querystring');
var url = require('url');
var zlib = require('zlib');

var db = require('./common/db.js');
var cfg = require('./common/config.js').search;
var trackers = require('./common/trackers.js');

//------------------------------------------------------------------------------
transaction_id = parseInt(Math.random()*100000000);



/* Search
 */
function search(rq, r, q, n) {
  //request parseing
  q = q.toLowerCase().match(/-?(\w)+/gi);
  var incl = [],
      excl = [];

  for(var i = 0; i < q.length; i++)
    if(q[i][0] == '-')
      excl.push(q[i].substr(1));
    else
      incl.push(q[i]);

  q = { kwd: {} };
  if(incl.length)
    q.kwd.$all = incl;
  if(excl.length)
    q.kwd.$nin = excl;

  // db request
  db.magnets.find(q, {
      kwd: 0,
    }, {
      limit: cfg.maxResults,
    })
    .sort({ 'sta.see': -1 })
    .toArray(function (err, list) {
      if(err || !list.length) {
        r.end('[]');
        return;
      }

      var s = null;
      function response() {
        if(s)
          return;

        s = JSON.stringify(list);
        if(rq.headers['accept-encoding'] &&
           rq.headers['accept-encoding'].search('gzip') != -1) {
          zlib.gzip(s, function(e, d) {
            if(e)
              r.end(s);
            else {
              r.setHeader('content-encoding', 'gzip');
              r.end(d);
            }
          });
        }
        else
          r.end(s);
      }

      if(n)
        response();

      setTimeout(function () { response(); }, 3000);

      trBox = new trackers.TrackerBox(list, function(err) {
        response();
      });
    });
}


//------------------------------------------------------------------------------
var serverStats;

function updateStats() {
  db.magnets.count({}, function (err, m) {
    if(err) m = 0;

    db.sources.count({ date: { $exists: 1}}, function (err, s) {
      if(err) s = 0;

      db.sources.count({}, function (err, t) {
        if(err) t = 0;

        serverStats = {
          m: m,
          s: s,
          t: t
        }
      });
    });
  });
  setTimeout(updateStats, 600000);
}

//------------------------------------------------------------------------------
server = http.createServer(function(rq, r) {
  //TODO: session number limits
  if(cfg.CORS)
    r.setHeader('Access-Control-Allow-Origin', cfg.CORS);

  var u = url.parse(rq.url);
  var l = u.pathname.split('/');

  switch(l[1]) {
    case 'stats':
      r.end(JSON.stringify(serverStats));
      break;

    case 'search':
      var q = qr.parse(u.query);

      if(!q.q) {
        r.end('[]');
        return;
      }

      if(q.q.substr(0, 19) == 'magnet:?xt=urn:btih') {
        var m = q.q.toLowerCase().match(/magnet:?\S+/);
        if(m)
          db.addMagnets(m);
        //TODO: return it
      }

      search(rq, r, q.q, q.nosl);
      break;

    case 'note':
      var m = l[2];
      db.magnets.update({ magnet: u.query },
        (l[2] == '1') ? { $inc: { 'sta.pon': 1 }} :
                        { $inc: { 'sta.nen': 1 }});
      r.end('[]');

      break;

    default:
      r.end('[]');
  }
});



//------------------------------------------------------------------------------
db.init(function () {
  updateStats();
  console.log('start listening on', cfg.host, cfg.port);
  server.listen(cfg.port, cfg.host);
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});



