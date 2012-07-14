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
function Request (u, cb) {
  log('> ' + u);
  this.u = u;
  this.o = url.parse(u);
  this.c = cb;

  var that = this;
  var rq = http.get(this.o, function (r) {
    if(r.statusCode && r.statusCode != 200) {
      if(r.statusCode >= 400)
        that.destroy(true);
      else (r.statusCode >= 300)
        try {
          manager.sources.push(r.headers.location);
          console.log('% ' + u + ' → ' + r.headers.location);
          that.destroy(r.headers.location);
        }
        catch(e) {}
      return;
    }

    if(!r.headers['content-type'] || r.headers['content-type'].search(/html/i) == -1) {
      rq.end();
      that.destroy(true);
      return;
    }

    that.body = '';
    r.on('data', function (d) {
      that.body += d.toString();
    })
    .on('end', function () {
      if(that.body.length)
        that.analyze();
      else
        that.destroy();
    })
    .on('error', function () {
    });
  })
  .on('error', function (e) {
    that.destroy(true);
  });

  this.r = rq;
}


Request.prototype = {
  destroy: function (fail) {
    var o = { $set: { date: Date.now() } }
    if(fail)
      o.$set.fail = fail;

    log('< ' + this.u);
    try {
      db.sources.update({ url: this.u }, o);
      this.c(this, fail);
    }catch(e) { console.log(e); }
  },


  analyze: function () {
    var l = this.body.match(magnets);
    if(l) {
      this.score = l.length;
      manager.magnets(this, l);
    }

    l = this.body.match(links);
    if(!l) {
      this.destroy();
      return;
    }

    var h = 'http://' + this.o.hostname;
    var p = this.o.path;
    p = p.substr(0, p.lastIndexOf('/'));

    var s = [];
    for(var i = 0; i < l.length; i++) {
      var u = url.parse(l[i].substring(7));
      if(u.protocol == 'magnet:' || u.length > _.urlSize)
        continue;

      if(!u.protocol) {
        if(u.path && u.path[0] == '/')
          u = h + u.path;
        else
          u = h + '/' + p + (u.path || '');
      }
      else if(u.protocol != 'http:' && u.protocol != 'https:')
        continue;
      else
        u = u.href;

      if(u != this.u)
        s.push(u);
    }

    var that = this;
    manager.sources = manager.sources.concat(s);
    this.destroy();
  },
}


//------------------------------------------------------------------------------
manager = {
  crawl: function (up) {
    this.sources = [];

    var o = { date: null };
    if(up)
      o = {};

    db.sources.findOne(o, function (e, d) {
      if(e || !d) {
        if(e)
          console.log(e);
        manager.crawl(true);
        return;
      }

      var u = url.parse(d.url);
      o.url = RegExp('^https?://' + u.hostname);
      db.sources
        .find(o, { limit: _.maxRequests })
        .sort({ date: 1 })
        .toArray(function (err, list) {
          var score = 0;
          var n = list.length;
          var cb = function (r, e) {
            n--;
            if(n) {
              score += r.score || 0;
              return;
            }

            db.hosts.update(
              { url: r.o.hostname || r.o.host },
              { $inc: { score: score, count: list.length } },
              { upsert: true },
              function () {
                list = manager.sources.sort();
                var l = [];
                for(var i = 0; i < list.length; i++)
                  if(list[i+1] && list[i+1] != list[i])
                    l.push(list[i]);

                db.addSources(l, function (e) {
                  if(e) {
                    console.log(e);
                    return;
                  }
                  manager.crawl();
                });
              });
          } // -- cb

          for(var i = 0; i < list.length; i++)
            list[i] = new Request(list[i].url, cb);
        });
    });
  },


  magnets: function (source, l) {
    console.log('# ', l.join('\n# '));
    db.addMagnets(source, l);
  },
}


//------------------------------------------------------------------------------
db.init(function () {
  if(process.argv.length > 2) {
    var n = process.argv.length-2;
    for(var i = 2; i < process.argv.length; i++)
      db.sources.insert({ url: process.argv[i] }, function () {
        if(--n <= 0)
          manager.crawl();
      });
  }
  else
    manager.crawl();
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});


