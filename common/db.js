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


var terms;
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
      coll.ensureIndex({ 'xt' : 1 }, { unique: true, dropDups: true }, function() {});
      coll.ensureIndex({ 'sta.see' : 1 }, function() {});

      db.collection('terms', function (err, coll) {
        if(err) {
          cberr(2, err);
          return;
        }

        terms = coll;

        db.collection('sources', function (err, coll) {
          if(err) {
            cberr(3, err);
            return;
          }

          sources = coll;
          coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});
          coll.ensureIndex({ 'date' : 1 }, function () {});

          d.terms = terms;
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
  var k = [];

  for(var i = 0; i < l.length; i++) {
    var q;
    if(l[i].substring)
      q = qr.parse(l[i].substring(8).replace(/&amp;/gi, '&'));
    else
      q = l[i];

    if(!q.dn || !q.xt) {
      console.log('no q.dn or q.xt for', s, q);
      continue;
    }

    q.xt = q.xt.toLowerCase(); //yep, this exists

    o.push(q.xt);
    var m = {
      xt: q.xt,
      dn: q.dn,
      //tr: q.tr,
    };

    if(q.xl)
      m.xl = q.xl;
    k.push(m);
  }

  var ts = {};

  /*  Algo: - add the magnets
   *        - update list of sources
   *        - score the page:
   *          - for all updated element, if there is one source, that's for our
   *            source, so add 1 point to score
   *          - update score
   */
  magnets.insert(k, function () {
    if(!s)
      return;

    magnets.update({ xt: { $in: o } }, { $addToSet: { src: s }}, { multi: true }, function (err) {
      magnets.find({ xt: { $in: o } }, { _id: 1, xt: 1, src: 1, dn: 1 })
      .toArray(function (err, list) {
        if(err || !list)
          return;

        var score = 0;
        for(var i = 0; i < list.length; i++) {
          if(list[i].src && list[i].src.length == 1)
            score++;

          var k = list[i].dn.toLowerCase().match(/\w\w\w*/gi);
          if(!k)
            continue;
          for(var j = 0; j < k.length; j++)
            try {
              if(ts[k[j]])
                ts[k[j]].push(list[i]._id.toHexString());
              else
                ts[k[j]] = [ list[i]._id.toHexString() ];
            }
            catch(e) {
              console.log(e);
              console.log(k[j]);
              console.log(ts);
              continue;
              process.exit(1);
            }
        }
        sources.update({ url: s }, { $inc: { score: score, count: 1 }});

        for(var i in ts)
          terms.update({ _id: i }, { $addToSet: { m: { $each: ts[i] }}}, { upsert: true });
      });
    });
  });
}


/*
 *  Add a source to db, and call cb(err)
 */
exports.addSources = function (l, cb) {
  do {
    var k = l.splice(0, 50);

    for(var i = 0; i < k.length; i++)
      k[i] = { 'url': k[i] };

    sources.insert(k);
  } while(l.length);
  cb();
}


exports.db = db;

