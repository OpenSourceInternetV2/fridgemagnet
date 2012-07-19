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

var db = require('./common/db.js');
var cfg = require('./common/config.js').search;

//------------------------------------------------------------------------------
transaction_id = parseInt(Math.random()*100000000);

blackTrackers = [ 'udp://tracker.openbittorrent.com:80' ];


function TrackerUDP (magnets, cb) {
  var host = magnets[0];
  var port = magnets[1];
  var sock = dgram.createSocket('udp4');

  magnets.splice(0,2);

  var conn_id, trans_id;
  var success = false;
  var stack;

  function action(a, d) {
    trans_id = ++transaction_id;
    var b = new Buffer(8);
    b.writeInt32BE(a, 0);             //action
    b.writeInt32BE(trans_id, 4);   //transaction id

    if(!d)
      b = Buffer.concat([conn_id, b]);
    else
      b = Buffer.concat([conn_id, b, d]);

    sock.send(b, 0, b.length, port, host,
      function(e, b) {
        if(e)
          console.log('error: ' + e);
      });
  }


  function scrap () {
    stack = magnets.splice(0, 50);
    var h = '';
    for(var i = 0; i < stack.length; i++)
      h += stack[i].h;

    try {
      action(2, new Buffer(h, 'hex'));
    }
    catch(e) {
      sock.close();
    }
  }


  function onScrap(m) {
    for(var i = 0, k = 8; i < stack.length; i++, k+=12) {
      var stats = stack[i].m.stats;
      stats.seeders = m.readInt32BE(k);
      stats.leechers = m.readInt32BE(k+8);

      db.magnets.update({ magnet: stack[i].m.magnet }, { $set: {
          'stats.date': stats.date,
          'stats.seeders': stats.seeders,
          'stats.leechers': stats.leechers
          }
      });
    }


    if(magnets.length) {
      scrap();
      return;
    }

    success = true;
    sock.close();
  }


  var tm = true;

  sock.on('message', function(m) {
    tm = false;
    var d = {
      action: m.readInt32BE(0),
      transaction: m.readInt32BE(4),
    };

    if(d.transaction != trans_id) {
      //console.log('not same transaction id ' + d.transaction + ' but should be ' + this.tr);
      sock.close();
      return;
    }

    switch(d.action) {
      case 0:
        conn_id = m.slice(8);
        scrap();
        break;

      case 2:
        onScrap(m);
        break;

      case 3:
        sock.close();
        return;
    }
  })
  .on('close', function () {
    cb(success);
  })
  .on('error', function () {
    cb(false);
  });

  conn_id = new Buffer([0x00, 0x00, 0x04, 0x17, 0x27, 0x10, 0x19, 0x80]);
  action(0);

  setTimeout(function () {
    if(tm)
      sock.close();
  }, cfg.trTimeout || 5000);
}



/* Search
 */
function search(r, q, s) {
  var mt = parseInt(Date.now()/1000) - 2100;
  var ts = parseInt(Date.now()/1000);

  q = q.toLowerCase().match(/-?(\w)+/gi);
  var incl = [],
      excl = [];

  for(var i = 0; i < q.length; i++)
    if(q[i][0] == '-')
      excl.push(q[i].substr(1));
    else
      incl.push(q[i]);

  q = { keywords: { $all: incl }};
  if(excl.length)
    q.keywords.$nin = excl;

  db.magnets.find(q, {
      _id: 0,
      keywords: 0,
    }, {
      limit: cfg.maxResults,
//      skip: s,
    })
    .sort({ 'stats.seeders': -1 })
    .toArray(function (err, list) {
      if(err || !list.length) {
        r.end('[]');
        return;
      }

      var tr = {};
      for(var i = 0; i < list.length; i++)
        try {
          var item = list[i];
          if(item.stats) {
            if(item.stats.date && item.stats.date >= mt)
              continue;

            item.stats.date = ts;
            item.stats.seeders = 0;
            item.stats.leechers = 0;
          }
          else
            item.stats = {
              date: ts,
              seeders: 0,
              leechers: 0
            }

          var m = qr.parse(item.magnet.substr(8));
          if(!m.tr)
            continue;

          //for the moment, only to one tracker
          //and only for udp:/
          var p, j = 0;

          for(var j = 0; j <= m.tr.length; j++) {
            if(blackTrackers.indexOf(m.tr[j]) != -1)
              continue;

            p = url.parse(m.tr[j]);
            if(p.protocol != 'udp:')
              continue;

            if(!tr[p.host])
              tr[p.host] = [p.hostname, p.port];

            var h = m.xt.lastIndexOf(':');
            h = (h != -1) ? m.xt.substr(h+1) : m.xt;
            tr[p.host].push({ m: item, h: h});
          }
        }
        catch(e) {}

      //we never know...
      var n = Object.keys(tr).length;
      if(!n) {
        r.end(JSON.stringify(list));
        return;
      }

      for(var i in tr)
        TrackerUDP(tr[i], function() {
            n--;
            if(!n)
              r.end(JSON.stringify(list));
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

      search(r, q.q/*, (q.s && parseInt(q.s)) || 0*/);
      break;

    case 'note':
      var m = l[2];
      db.magnets.update({ magnet: u.query },
        { $inc: { 'stats.note': (l[2] == '1' ? 1 : 0), 'stats.count': 1 }});
      r.end('[]');

      break;

    default:
      r.end('[]');
  }
});



//------------------------------------------------------------------------------
db.init(function () {
  updateStats();
  server.listen(cfg.port, cfg.host);
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});



