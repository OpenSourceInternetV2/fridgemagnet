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
var utils = require('./utils.js');


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
      coll.ensureIndex({ 'infohash': 1 }, { unique: true, dropDups: true }, function () {});
      coll.ensureIndex({ 'keywords': 1 }, function () {});

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
exports.addMagnets = function (s, l) {
  var o = [];

  console.log(s);
  /* for(var i = 0; i < l.length; i++) {*/
  l.forEach(function(e, i) {
    var q = qr.parse(e.substring(8));

    //FIXME for the moment:
    if(!q.dn)
      return;

    o.push(q.xt);
    l[i] = {
      infohash: q.xt,
      magnet: e,
      name: q.dn,
      keywords: q.dn.toLowerCase().match(/(\w)+/gi),
    };
  });

  magnets.insert(l);
  //console.log(l);
  magnets.update({ infohash: { $in: o } }, { $addToSet: { sources: s }});
}


/*
 *  Add a source to db, and call cb(err)
 */
exports.addSources = function (l, cb) {
  var hs = {};

  for(var i = 0; i < l.length; i++) {
    var h = utils.host(url.parse(l[i]).hostname);
    if(!h || h.search(_.banish) != -1)
      continue;

    if(hs[h])
      hs[h].push({ url: l[i] });
    else
      hs[h] = [{ url: l[i] }];
  }

  hosts.find({ url: { $in: Object.keys(hs) }})
    .toArray(function (err, list) {
      if(!err)
        for(var i = 0; i < list.length; i++) {
          var host = list[i];
          if(host.count < _.quotaCount || (host.score / host.count) >= _.quotaR)
            continue;

          sources.remove({
            url: RegExp('^https?://([^\/]+\.)?' + host.url.replace(/\./, '\\.') + '/.*', 'gi')
          });

          delete hs[host.url];
        }

      list = [];
      for(var i in hs)
        list = list.concat(hs[i]);

      do {
        sources.insert(list.splice(0, 50));
      } while(list.length);
      cb();
    });
}


exports.db = db;

