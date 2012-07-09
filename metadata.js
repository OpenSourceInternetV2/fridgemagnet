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

var qr = require('querystring');

var db = require('./common/db.js');
var cfg = require('./common/config.js').metadata;


var log = function () {};
if(cfg.log)
  log = function(v) { console.log(v); }


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
    log(n);
    db.magnets.update({ magnet: u },
      { $set: { name: n, keywords: n.toLowerCase().split(/\W+/) } });
  },


  next: function () {
    if(this.n >= cfg.nRequests)
      return;

    db.magnets.find({ name: null })
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

        setTimeout(function() {
          manager.next();
        }, 1000);
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

