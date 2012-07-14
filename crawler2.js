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
var _ = require('./common/config.js').main;


var log = function () {};
if(require('./common/config.js').main.log)
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
      this.o= null;
      return;
    }

    var o = url.parse(u);
    if(!o.host) throw "not a valid url";
    if(!o.port) o.port = 80;

    this.o = o;

    var rq = this;
    var req = http.get(o, function (r) {
      if(r.statusCode && r.statusCode != 200) {
        if(r.statusCode >= 400)
          manager.end(rq, true);
        else (r.statusCode >= 300)
          try {
            manager.source(rq, r.headers.location);
            manager.end(rq);
          }
          catch(e) {}
        return;
      }

      if(!r.headers['content-type'] || r.headers['content-type'].search(/html/i) == -1) {
        manager.end(rq, true);
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
        manager.end(rq);
      })
      .on('error', function () {
      });
    })
    .on('error', function (e) {
      manager.end(rq);
    });

    this.r = req;
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

    var host = 'http://' + this.o.host;
    var path = this.o.path;
    path = path.substr(0,path.lastIndexOf('/'));

    for(var i = 0; i < list.length; i++) {
      var u = url.parse(list[i].substring(7));
      if(u.protocol == 'magnet:' || u.length > _.urlSize)
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
        manager.source(u);
    }
  },
}



//------------------------------------------------------------------------------
manager = {
  _n: 0,
  list: [],
  hosts: {},


  next: function (t) {
    if(this.list.length >= _.maxRequests)
      return;

    var q = { date: null, scanning: null };
    if(t)
      q = {};

    var m = this;
    db.sources.find(q, { limit: _.maxRequests - this.list.length })
      .sort({ date: 1 })
      .toArray(function (err, list) {
        if(err || !list.length) {
          log('no data');
          m.next(true);
          return;
        }

        for(var i = 0; i < list.length && m.list.length < _.maxRequests; i++) {
          m.request(list[i].url);
        }
      });
  },


  /* Create a new request
   *
   */
  request: function(u) {
    if(this.list.length >= _.maxRequests ||
       this.list.indexOf(u) != -1)
      return;

    var m = this;
    db.sources.update({ url: u }, {$set: { scanning: true }}, function (e) {
      if(e)
        return;

      var h;
      try {
        var e = new Request(u);
        h = e.o.host;
      }
      catch(e) {
        db.sources.update({ url: u }, { $set: { date: Date.now() }, $unset: { scanning: 1 }});
        return;
      }

      m.list.push(u);
      if(m.hosts[h])
        m.hosts[h].push(e);
      else
        m.hosts[h] = [ e ];
    });
  },


  /*  Called when a request is done, clean everything
   *  (request[, fail])
   */
  end: function(r, f) {
    var o = {
      $set: { date: Date.now() },
      $unset: { scanning: 1 },
    };

    if(f)
      o.$set.fail = true;
    else
      db.hosts.update({ url: r.o.host }, { $inc: { score: r.score, count: 1 }}, { upsert: true});

    var m = this;
    db.sources.update({ url: r.url }, o, function () {
      log('< ' + r.url);
      try {
        var l = m.hosts[r.o.host];
        if(l) {
          l.splice(l.indexOf(r), 1);
          if(!l.length)
            delete m.list[r.o.host];
        }
      }
      catch(e) {};

      m.list.splice(m.list.indexOf(r.url), 1);
      m.next();
    });
  },


  /* Aborts all requests from a host
   */
  abort: function(h) {
    var l = this.hosts[h];
    if(!l)
      return;

    console.log('abort:', h);
    for(var i = 0; i < l.length; i++)
      try {
        l[i].r.abort();
      }
      catch(e) {};

    //this.list ?

    delete this.hosts[h];
  },


  /* Add a source
   */
  source: function(u) {
    db.source(u, function (e, h) {
      if(!e)
        return;
      manager.abort(h);
    });
  },


  /* Add a magnet
   */
  magnet: function (r, u) {
    db.magnet(u, r.url);
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
  //db.sources.remove({ url: _.banish });

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


