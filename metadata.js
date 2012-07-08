#! /usr/bin/env node
var qr = require('querystring');

var db = require('./common/db.js');
var cfg = require('./common/config.js');

var manager = {
  _n: 0,

  get n() {
    return this._n;
  },

  set n(v) {
    if(v <= 0) {
      this._n = 0;
      this.next();
    }
    else
      this._n = v;
  },


  set: function (u, n) {
    console.log(n);
    db.magnets.update({ magnet: u },
      { $set: { name: n, keywords: n.toLowerCase().split(/(\W/) } });
  },


  next: function () {
    if(this.n >= cfg.nRequests)
      return;

    db.magnets.find({ name: null }, { limit: cfg.nRequests - this.n })
      .toArray(function (err, list) {
        if(err || !list.length) {
          setTimeout(function () {
            manager.next();
          }, 1000);
          return;
        }

        manager.n += list.length;
        for(var i = 0; i < list.length; i++) {
          var q = qr.parse(list[i].magnet);

          if(q.dn) {
            manager.set(list[i].magnet, q.dn);
            manager.n--;
            continue;
          }

          //TODO: launch metadata infos
        }
      });
  },
}


db.init(function() {
  manager.next();
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});

