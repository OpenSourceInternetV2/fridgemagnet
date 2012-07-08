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
      coll.ensureIndex({ 'name': 1 }, function () {});
      coll.ensureIndex({ 'sources': 1 }, function () {});

      db.collection('hosts', function (err, coll) {
        if(err) {
          cberr(2, err);
          return;
        }

        d.hosts = coll;
        coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});
        //coll.ensureIndex({ 'date' : 1 }, function () {});

        db.collection('sources', function (err, coll) {
          if(err) {
            cberr(3, err);
            return;
          }

          d.sources = coll;
          coll.ensureIndex({ 'url' : 1 }, { unique: true, dropDups: true }, function() {});
          coll.ensureIndex({ 'date' : 1 }, function () {});

          cb();
        });
      });
    });
  });
}

exports.db = db;

