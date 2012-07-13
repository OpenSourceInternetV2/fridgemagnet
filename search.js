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
 *  /search/?q=
 *
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


function TrackerUDP (magnets, cb) {
  var host = magnets[0];
  var port = magnets[1];
  var sock = dgram.createSocket('udp4');

  magnets.splice(0,2);

  var conn_id, trans_id;

  function action(a, d) {
    trans_id = ++transaction_id;
    var b = new Buffer(8);
    b.writeInt32BE(a, 0);             //action
    b.writeInt32BE(trans_id, 4);   //transaction id

    if(!d)
      b = Buffer.concat([conn_id, b]);
    else
      b = Buffer.concat([conn_id, b, d]);

    //console.log('> ', b.length, ' ', b);
    sock.send(b, 0, b.length, port, host,
    function(e, b) {
      if(e)
        console.log('error: ' + e);
    });
  }

  var success = false;
  sock.on('message', function(m) {
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
        //scrapp :)
        //console.log('# ', conn_id);
        var h = '';

        for(var i = 0; i < magnets.length; i++)
          h += magnets[i].h;

        action(2, new Buffer(h, 'hex'));
        break;

      case 2:
        var s = 8;
        for(var i = 0, k=8; i < magnets.length; i++, k+=12)
          stats.update(magnets[i].m, m.readInt32BE(k), m.readInt32BE(k+8));

        success = true;
        sock.close();
        break;

      case 3:
        sock.close();
        return;
    }
  })
  .on('close', function () {
    cb(success, magnets);
  })
  .on('error', function () {
    cb(false);
  });

  conn_id = new Buffer([0x00, 0x00, 0x04, 0x17, 0x27, 0x10, 0x19, 0x80]);
  action(0);
}



var stats = {
  update: function(m, s, l) {
    m.stats.seeders = Math.max(s, m.stats.seeders);
    m.stats.leechers = Math.max(l, m.stats.leechers);
  },

  get: function (list, cb) {
    var ts = parseInt(Date.now()/1000);
    var min = ts - 2100;
    var tr = {};
    var updated = [];

    for(var i = 0; i < list.length; i++) {
      var item = list[i];
      if(item.stats && item.stats.date >= min)
        continue;

      updated.push(item);

      if(item.stats) {
        item.stats.date = ts;
        item.stats.seeders = 0;
        item.stats.leechers = 0;
      }
      else
        item.stats = {
          date: ts,
          seeders: 0,
          leechers: 0,
        }

      var q = item.magnet.substr(8);
      q = qr.parse(q);

      if(!q.tr)
        continue;

      for(var j = 0; j < q.tr.length; j++) {
        var p = url.parse(q.tr[j])

        if(p.protocol == 'udp:') {
          if(!tr[p.host])
            tr[p.host] = [p.hostname, p.port];

          var h = q.xt.lastIndexOf(':');
          h = (h == -1) ? q.xt : q.xt.substr(h+1);
          tr[p.host].push({ m: list[i], h: h});
        }
        //TODO: http
      }
    }

    var n = Object.keys(tr).length;
    if(!n) {
      cb();
      return;
    }

    for(var i in tr)
      TrackerUDP(tr[i], function(magnets, m) {
        /*console.log(n);
        n--;
        if(n)
          return;*/

        cb();

        for(var i = 0; i < updated.length; i++)
          db.magnets.update({ magnet: updated[i].magnet }, { $set: { stats: updated[i].stats } });
      });

  }

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
/*var query = function (q, c) {
  var l = q.q.split(/(\W|\+)+/gi);
  db.magnets.find({
    keywords: { $in: l },
  }, {
    keywords: 0,
    _id: 0,
  }, {
    limit: 50,
    skip: q.s || 0,
  })
  .toArray(c);
}*/
/*if(cfg.mongo21)
  query = function (q, c) {
    db.magnets.aggregate([
      { $match: { keywords: {  $in: q.q.split(/(\W|\+)+/gi) }}},
      { $unwind: '$keywords' },
      { $group: { keywords: { keywords: 1},
                  magnet: '$magnet',
                  sources: '$sources',
                  stats: '$stats',
                  match_: { $sum: 1 }}},
      { $sort: { match_: -1 }}
    ], function (err, l) {
      console.log(err);
    });
  }*/


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

      //TODO: http://stackoverflow.com/questions/9822910/mongo-custom-multikey-sorting
      //      (when 2.1 is out)
      q.q = q.q.replace(/\W+$/gi, '');
      db.magnets.find({
          keywords: { $in: q.q.split(/(\W|\+)+/gi) },
        }, {
          keywords: 0,
          _id: 0,
        }, {
          limit: 50,
          skip: q.s || 0,
        })
        .toArray(function (err, list) {
          if(err || !list.length) {
            r.end('[]');
            return;
          }

          stats.get(list, function () {
            r.end(JSON.stringify(list));
          });
        });
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



