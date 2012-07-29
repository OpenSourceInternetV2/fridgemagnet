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
var https = require('https');
var url = require('url');
var qr = require('querystring');
var zlib = require('zlib');

var db = require('./common/db.js');
var _ = require('./common/config.js').main;
var torrent = require('./common/torrent.js');
var utils = require('./common/utils.js');

const links = /\shref=\"[^"]+/gi;
const magnets = /magnet:[^\s"\]]+/gi;

var stayOnDomain = false;


//------------------------------------------------------------------------------
function Request (u, cb) {
  this.u = u;
  this.o = url.parse(u);
  this.c = cb;

  this.o.headers = {
    'accept-encoding': 'gzip'
  };

  var that = this;
  var rq = ((this.o.protocol == 'https:') ? https : http).get(this.o, function (r) {
    if(r.statusCode && r.statusCode != 200) {
      if(r.statusCode >= 400)
        that.destroy(true);
      else (r.statusCode >= 300)
        try {
          manager.sources.push(r.headers.location);
          utils.log('% ' + u + ' → ' + r.headers.location);
          that.destroy(r.headers.location);
        }
        catch(e) {}
      return;
    }


    if(r.headers['content-type'] == 'application/x-bittorrent')
      that.analyze = that.analyze_;
    else if(!r.headers['content-type'] || r.headers['content-type'].search(/html/i) == -1) {
      rq.end();
      that.destroy(true);
      return;
    }

    that.body = [];

    var pipe = r;
    if(r.headers['content-encoding'] == 'gzip') {
      pipe = zlib.createGunzip();
      r.pipe(pipe);
    }

    pipe.on('data', function (d) {
      that.body.push(d);
    })
    .on('end', function () {
      if(that.body.length) {
        that.body = Buffer.concat(that.body);
        that.analyze();
      }
      else
        that.destroy();
    })
    .on('error', function () {
    });
  })
  .on('error', function (e) {
    that.destroy(true);
  });

  /*rq.setTimeout(_.s2sTimeout, function() {
    that.destroy(true);
  });*/

  this.r = rq;
}


Request.prototype = {
  destroy: function (fail) {
    var o = { $set: { date: Date.now() } }
    if(fail)
      o.$set.fail = fail;

    //log('< ' + this.u);
    try {
      db.sources.update({ url: this.u }, o);
      if(this.c)
        this.c(this, fail);
    } catch(e) { console.log(e); }
  },


  analyze: function () {
    this.body = this.body.toString();
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


    var h = this.o.protocol + '//' + this.o.hostname;
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

      if(stayOnDomain && u.search(stayOnDomain) == -1)
        continue;

      if(u != this.u)
        s.push(u);
    }

    var that = this;
    manager.sources = manager.sources.concat(s);
    this.destroy();
  },


  analyze_: function () {
    try {
      utils.log('T ' + this.u);
      var o = { $addToSet: { src: this.u } }
      o.$set = torrent.decode(this.body);

      if(!o.$set || !o.$set.dn) {
        this.destroy(true);
        return;
      }

      db.magnets.update({ _id: o.$set.xt }, o, { upsert: true});

      this.score = 1;
      this.destroy();
    }
    catch(e) {
      console.log(e);
      this.destroy(true);
    }
  },
}


//------------------------------------------------------------------------------
manager = {
  crawl: function (up) {
    this.sources = [];

    var o = { date: null };

    if(up)
      o = {};
    else if(stayOnDomain)
      o.url = stayOnDomain;

    db.sources.findOne(o, function (e, d) {
      if(e || !d) {
        if(e)
          console.log(e);
        else if(o.url)
          console.log('no more for ', o.url);
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
          function cb (r, e) {
            n--;
            if(n) {
              score += r.score || 0;
              return;
            }

            db.hosts.update(
              { url: utils.host(r.o.hostname) },
              { $inc: { score: score, count: list.length } },
              { upsert: true }, function() {
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

          utils.log('> ' + list.length + ' @ ' +  u.hostname);
          for(var i = 0; i < list.length; i++)
            list[i] = new Request(list[i].url, cb);
        });
    });
  },


  magnets: function (source, l) {
    utils.log('# ' + l.length + ' ' + source.u);
    db.addMagnets(source.u, l);
  },
}


//------------------------------------------------------------------------------
db.init(function () {
  var a = process.argv;
  var o = utils.argv('fridgemagnet - crawler', a, {
    '-s': { d: 'crawl on url matching the regexp' },
    '-t': { d: 'set a timeout before exit process (in seconds)' },
  })

  if(o['-s'])
    stayOnDomain = new RegExp(o['-s'], 'gi');

  if(o['-t'])
    setTimeout(function () { process.exit(0); }, parseInt(o['-t'])*1000);

  if(a.length) {
    var n = a.length;
    for(var i = 0; i < a.length; i++)
      db.sources.insert({ url: a[i] }, function () {
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


