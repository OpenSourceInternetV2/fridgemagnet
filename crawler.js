#! /usr/bin/env node
var cfg = {
  nRequest: 30,
  urlSize: 128,
  hostCount: 1000,
  hostScore: 1,

  banish:
    /twitter|facebook|linkedin|google|youtube|deezer|dailymotion|vimeo|identi.ca|wikipedia|amazon|ebay|imdb|vimeo|itunes|apple|manual|reference|rediff|myspace|hotmail|digg|thumblr|flickr|bbc\.co|(\.gov$)|reddit|adverti(s|z)ing|soir\.be|nytime/i,
}

var http = require('http');
var url = require('url');
var db = require('./common/db.js');

const links = /\shref=\"[^"]+/gi;
const magnets = /magnet:[^\s"\]]+/gi;



//------------------------------------------------------------------------------
function Request (u) {
  this.url = u;
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
          crawler.done(rq);
        else (r.statusCode >= 300)
          try {
            crawler.todo(r.headers.location);
            crawler.done(rq);
          }
          catch(e) {}
        return;
      }

      if(!r.headers['content-type'] || r.headers['content-type'].search(/html/i) == -1) {
        crawler.fail(rq);
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
        crawler.done(rq);
      })
      .on('error', function () {
        crawler.done(rq);
      });
    })
    .on('error', function (e) {
      crawler.done(rq);
    });
  },


  analyze: function () {
    var list = this.body.match(magnets);
    if(list) {
      this.score = list.length;
      for(var i = 0; i < list.length; i++)
        crawler.magnet(this, list[i]);
    }


    list = this.body.match(links);
    if(!list)
      return;

    var host = 'http://' + this.options.host;
    var path = this.options.path;
    path = path.substr(0,path.lastIndexOf('/'));

    for(var i = 0; i < list.length; i++) {
      var u = url.parse(list[i].substring(7));
      if(u.protocol == 'magnet:')
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

      crawler.todo(u);
    }
  },
}



//------------------------------------------------------------------------------
crawler = {
  _n: 0,

  get n() {
    return this._n;
  },

  set n(v) {
    if(v <= 0) {
      this._n = 0;
      crawler.next();
    }
    else
      this._n = v;
  },


  next: function (t) {
    if(this.n == cfg.nRequest)
      return;

    var q = { date: null };
    if(t)
      q = {};

    db.sources.find(q, { limit: cfg.nRequest - this.n })
      .sort({ date: -1 })
      .toArray(function (err, list) {
        if(err || !list.length) {
          console.log('error:' + err);
          crawler.next(true);
          return;
        }

        for(var i = 0; i < list.length; i++)
          try {
            var u = list[i].url

            db.sources.update({ url: u }, {$set: {date: Date.now() }});
            u = new Request(u);

            this.n++;
          }
          catch(e) {
            crawler.fail(list[i].url);
          }
      });
  },


  done: function (r) {
    if(r.body && r.body.length)
      console.log('< ' + r.url);

    db.hosts.insert({ url: r.options.host, count: 0, score: 0 });
    db.hosts.update({ url: r.options.host }, { $inc: { score: r.score, count: 1 }});
    this.n--;
  },


  fail: function (r, e) {
    db.sources.update({ url: r.url }, { $set: { fail: e || true }});
    this.n--;
  },


  todo: function (u) {
    var h = url.parse(u).host;
    if(!h || h.search(cfg.banish) != -1)
      return;

    db.sources.findOne({ url: u }, function (err, d) {
      if(d && d.count >= cfg.hostCount &&
         (d.score / d.count) < (cfg.hostScore / cfg.hostCound))
        return;
      db.sources.insert({ url: u });
    });
  },


  magnet: function (r, u) {
    db.magnets.insert({ magnet: u }, function () {
      db.magnets.update({ magnet: u }, { $addToSet: { sources: r.url }});
    });
    console.log('# ' + u);
  },

}



//------------------------------------------------------------------------------
db.init(function () {
  //clean up if change in banish
  //db.sources.remove({ url: cfg.banish });

  if(process.argv.length > 2) {
    var n = process.argv.length-2;
    for(var i = 2; i < process.argv.length; i++)
      db.sources.insert({ url: process.argv[i] }, function () {
        if(--n <= 0)
          crawler.next();
      });
  }
  else
    crawler.next();
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});


