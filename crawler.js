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

var http = require('http');
var url = require('url');
var qr = require('querystring');

var db = require('./common/db.js');
var cfg = require('./common/config.js').crawler;


var log = function () {};
if(cfg.log)
  log = function(v) { console.log(v.substr(0, 80)); }


const links = /\shref=\"[^"]+/gi;
const magnets = /magnet:[^\s"\]]+/gi;


//------------------------------------------------------------------------------
function Request (u) {
  this.url = u;
  this.score = 0;
}

Request.prototype = {
  score: 0,

  get url () {
    return this._u;
  },

  set url (u) {
    this._u = u;
    if(!u) {
      this.options = null;
      return;
    }

    this.options = url.parse(u);
    if(!this.options.host)
      throw "not a valid url";

    var rq = this;
    var req = http.get({
      host: this.options.host,
      port: this.options.port || 80,
      path: this.options.path
    },
    function (r) {
      if(r.statusCode && r.statusCode != 200) {
        if(r.statusCode >= 400)
          manager.done(rq);
        else (r.statusCode >= 300)
          try {
            manager.todo(rq, r.headers.location);
            manager.done(rq);
          }
          catch(e) {}
        return;
      }

      if(!r.headers['content-type'] || r.headers['content-type'].search(/html/i) == -1) {
        manager.fail(rq);
        req.end();
        return;
      }

      rq.body = "";
      r.on('data', function (d) {
        rq.body += d.toString();
      })
      .on('end', function () {
        if(rq.body.length)
          rq.analyze();
        manager.done(rq);
      })
      .on('error', function () {
      });
    })
    .on('error', function (e) {
      manager.done(rq);
    });
  },


  analyze: function () {
    var list = this.body.match(magnets);
    if(list) {
      this.score = list.length;
      for(var i = 0; i < list.length; i++)
        manager.magnet(this, list[i]);
    }

    list = this.body.match(links);
    if(!list)
      return;

    var host = 'http://' + this.options.host;
    var path = this.options.path;
    path = path.substr(0,path.lastIndexOf('/'));

    for(var i = 0; i < list.length; i++) {
      var u = url.parse(list[i].substring(7));
      if(u.protocol == 'magnet:' || u.length > cfg.urlSize)
        continue;

      //relative
      if(!u.protocol) {
        if(u.path && u.path[0] == '/')
          u = host + u.path;
        else
          u = host + '/' + path + (u.path || '');
      }
      else if(u.protocol != 'http:' && u.protocol != 'https:')
        continue;
      else
        u = u.href;

      if(u != this.url)
        manager.todo(this, u);
    }
  },
}



//------------------------------------------------------------------------------
manager = {
  _n: 0,
  list: [],


  next: function (t) {
    if(this.list.length >= cfg.nRequests)
      return;

    var q = { date: null, scanning: null };
    if(t)
      q = {};

    db.sources.find(q, { limit: cfg.nRequests - this.list.length })
      .sort({ date: 1 })
      .toArray(function (err, list) {
        if(err || !list.length) {
          log('no data');
          manager.next(true);
          return;
        }

        list.forEach(function(d, i) {
          var u = d.url;
          if(manager.list.indexOf(u) != -1)
            return;

          if(manager.list.length < cfg.nRequests)
            db.sources.update({ url: u }, {$set: { scanning: true }}, function () {
              try {
                manager.list.push(u);
                new Request(u);
              }
              catch(e) {
                manager.fail(d.url);
              }
            });
        });
      });
  },


  done: function (r) {
    if(r.body && r.body.length)
      log('< ' + r.url);

    db.hosts.update({ url: r.options.host }, { $inc: { score: r.score, count: 1 }}, { upsert: true});

    db.sources.update({ url: r.url },
      { $set: { date: Date.now() }, $unset: { scanning: 1 }},
      function () {
        manager.list.splice(manager.list.indexOf(r.url), 1);
        manager.next();
      });
  },


  fail: function (r, e) {
    db.sources.update({ url: r.url },
      { $set: { fail: e || true, date: Date.now() }, $unset: { scanning: 1 }},
      function () {
        manager.list.splice(manager.list.indexOf(r.url), 1);
        manager.next();
      });
  },


  todo: function (r, u) {
    var h = url.parse(u).host;
    if(!h || h.search(cfg.banish) != -1)
      return;

    db.hosts.findOne({ url: h }, function (err, d) {
      if(d && d.count >= cfg.hostCount &&
         (d.score / d.count) < cfg.hostScore) {
         db.sources.remove({ url: RegExp('^https?://' + h.replace(/\./, '\\.') + '/.*', 'gi') });
         return;
      }
      db.sources.insert({ url: u });
    });
  },


  magnet: function (r, u) {
    var o = { $addToSet: { sources: r.url } };
    var q = qr.parse(u);

    if(q.dn)
      o.$set = {
        name: q.dn,
        keywords: q.dn.toLowerCase().split(/\W+/)
      };

    db.magnets.update({ magnet: u }, o, { upsert: true });
    log('# ' + u);
  },

}



//------------------------------------------------------------------------------
function tn() {
  manager.next();
  setTimeout(tn, 10000);
}


db.init(function () {
  //clean up if change in banish
  //db.sources.remove({ url: cfg.banish });

  db.sources.update({ scanning: true }, { $unset: { scanning: 1 } }, { multi: true }, function () {
    if(process.argv.length > 2) {
      var n = process.argv.length-2;
      for(var i = 2; i < process.argv.length; i++)
        db.sources.insert({ url: process.argv[i] }, function () {
          if(--n <= 0)
            manager.next();
        });
    }
    else
      manager.next();
  });
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});


