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

var cfg = require('./config.js').db;

/*
 *  magnet: {
 *    _id:
 *    magnet:
 *    name:
 *    date:
 *    rate: [ somme , #votes ]
 *    comments:
 *  }
 *
 *  hosts: {
 *    url:
 *    count:
 *    score:
 *  }
 *
 *  source: {
 *    url:
 *    date:
 *  }
 */

var mongo = require('mongodb');
var Server = mongo.Server;
var DB = mongo.Db;

var server = new Server(cfg.host, cfg.port, cfg.options);
var db = new DB(cfg.db, server);

exports.init = function (cb, cberr) {
  var d = this;

  db.open(function(err, db) {
    if(err) {
      cberr(0, err);
      return;
    }

    db.collection('magnets', function (err, coll) {
      if(err) {
        cberr(1, err);
        return;
      }

      d.magnets = coll;
      coll.ensureIndex({ 'magnet': 1 }, { unique: true, dropDups: true }, function () {});
      coll.ensureIndex({ 'keywords': 1 }, function () {});
      coll.ensureIndex({ 'sources': 1 }, function () {});

      db.collection('hosts', function (err, coll) {
        if(err) {
          cberr(2, err);
          return;
        }

        d.hosts = coll;
        coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});

        db.collection('sources', function (err, coll) {
          if(err) {
            cberr(3, err);
            return;
          }

          d.sources = coll;
          coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});
          coll.ensureIndex({ 'date' : 1 }, function () {});
          coll.ensureIndex({ 'scanning' : 1 }, function () {});

          cb();
        });
      });
    });
  });
}

exports.db = db;

