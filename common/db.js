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
var url = require('url');
var mongo = require('mongodb');

var cfg = require('./config.js').db;
var _ = require('./config.js').main;


var server = new mongo.Server(cfg.host, cfg.port, cfg.options);
var db = new mongo.Db(cfg.db, server);


var hosts;
var magnets;
var sources;


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

      magnets = coll;
      coll.ensureIndex({ 'magnet': 1 }, { unique: true, dropDups: true }, function () {});
      coll.ensureIndex({ 'keywords': 1 }, function () {});
      coll.ensureIndex({ 'sources': 1 }, function () {});

      db.collection('hosts', function (err, coll) {
        if(err) {
          cberr(2, err);
          return;
        }

        hosts = coll;
        coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});

        db.collection('sources', function (err, coll) {
          if(err) {
            cberr(3, err);
            return;
          }

          sources = coll;
          coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});
          coll.ensureIndex({ 'date' : 1 }, function () {});
          coll.ensureIndex({ 'scanning' : 1 }, function () {});

          d.hosts = hosts;
          d.magnets = magnets;
          d.sources = sources;
          cb();
        });
      });
    });
  });
}


/*
 *  Append the magnet m, from source s
 */
exports.magnet = function (m, s) {
  var o = { $addToSet: { sources: s } };
  var q = qr.parse(m);

  if(q.dn)
    o.$set = {
      name: q.dn,
      keywords: q.dn.toLowerCase().split(/\W+/)
    }
  magnets.update({ magnet: m }, o, { upsert: true });
}

/*
 *  Add a source to db, and call cb(err)
 */
exports.source = function (u, cb) {
  var h = url.parse(u).host;
  if(!h || h.search(_.banish) != -1)
    return;

  hosts.findOne({ url: h }, function (err, d) {
    if(d && d.count >= _.quotaCount && (d.score / d.count) < _.quotaR ) {
      sources.remove({ url: RegExp('^https?://' + h.replace(/\./, '\\.') + '/.*', 'gi') });
      cb(true, h);
      return;
    }
    sources.insert({ url: u });
    cb(false);
  });
}


exports.db = db;

