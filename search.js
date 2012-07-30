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
var qr = require('querystring');
var url = require('url');
var zlib = require('zlib');

var utils = require('./common/utils.js');
var db = require('./common/db.js');
var cfg = require('./common/config.js').search;
var trackers = require('./common/trackers.js');

const magnets = /magnet:[^\s"\]]+/gi;

//------------------------------------------------------------------------------
/* Search
 */
function search(rq, r, q, n) {
  //request parseing
  q = q.toLowerCase().match(/-?\w\w\w*/gi);
  if(!q) {
    r.end('[]');
    return;
  }

  var incl = [],
      excl = [];

  for(var i = 0; i < q.length; i++)
    if(q[i][0] == '-')
      excl.push(q[i].substr(1));
    else
      incl.push(q[i]);

  q = { kwd: {} };
  if(incl.length)
    q._id.$in = incl;
/*  if(excl.length)
    q.kwd.$nin = excl;*/

  db.terms.find(q, { m: 1 }, { limit: 9 })
  .toArray(function (err, list) {
    if(err || !list.length || list.length != incl.length) {
      r.end('[]');
      return;
    }

    var id = 0;
    var min = list[0].m.length;
    for(var i = 1; i < list.length; i++)
      if(list[i].m.length > min) {
        id = i;
        min = list[i].m.length;
      }

    var res = [];
    var ms = list[id].m;
    for(var i = 1; i < ms.length; i++) {
      var d = ms[i];
      var f = true;
      for(var j = 0; !f && j < list.length; j++) {
        if(j == id)
          continue;
        if(list[j].m.indexOf(ms[i]) == -1) {
          f = false;
          break;
        }
      }

      if(f)
        res.push(d);
    }

    //free resources
    delete list;
    delete ms;

    if(!res.length) {
      r.end('[]');
      return;
    }

    db.magnets.find({ _id: { $in: res }}, { limit: cfg.maxResults })
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
function addMagnets (m, q) {
  if(q.s)
    try {
      var o = url.parse(q.s);

      if(!o)
        return;

      var r = utils.get(o, function(data, isTorrent) {
          if(isTorrent) {
            try {
              data = torrent.decode(data);
              if(data.xt)
                db.addMagnets(o.href || q.s, m);
            }
            catch(e) {}
            return;
          }

          data = data.toString();
          var l = data.match(magnets);
          if(l)
            db.addMagnets(o.href || q.s, l.concat(m));
        },
        function () {
        });
    }
    catch(e) { console.log(e); }
  else
    db.addMagnets(null, m);
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

      var m = q.q.match(/magnet:\?xt=\S+/gi);
      if(m && m.length) {
        addMagnets(m, q);
        r.end('[]');
      }

      search(rq, r, q.q, q.nosl);
      break;

    case 'note':
      var m = l[2];
      db.magnets.update({ xt: u.query },
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



