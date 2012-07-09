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

/* API (using get methode)
 *  /search/?q=
 *
 *
 */

var http = require('http');
var qr = require('querystring');
var url = require('url');

var db = require('./common/db.js');
var cfg = require('./common/config.js').search;


//------------------------------------------------------------------------------
server = http.createServer(function(rq, r) {
  //TODO: session number limits
  if(cfg.CORS)
    r.setHeader('Access-Control-Allow-Origin', cfg.CORS);

  var u = url.parse(rq.url);
  var l = u.pathname.split('/');

  switch(l[1]) {
    case 'stats':
      db.magnets.count({}, function (err, m) {
        if(err)
          m = 0;

        db.sources.count({ date: { $exists: 1}}, function (err, s) {
          if(err)
            s = 0;

          db.sources.count({}, function (err, t) {
            if(err)
              t = 0;

            r.end('{"m":' + m + ',"s":' + s + ',"t":' + t + '}');
          });
        });
      });

      break;

    case 'search':
      var q = qr.parse(u.query);

      if(!q.q) {
        r.end('[]');
        return;
      }

      //TODO: http://stackoverflow.com/questions/9822910/mongo-custom-multikey-sorting
      //      (when 2.1 is out)
      q.q = q.q.replace(/\W+$/gi, '');
      db.magnets.find({
          keywords: { $in: q.q.split(/(\W|\+)+/gi) },
        }, {
          keywords: 0,
          _id: 0,
        }, {
          limit: (q.l < cfg.maxResults && q.l) || 50,
          skip: q.s || 0,
        })
        .toArray(function (err, list) {
          if(err || !list.length)
            r.end('[]');
          else
            r.end(JSON.stringify(list));
        });

      break;

    case 'sources':
      if(!u.query) {
        r.end('[]');
        return;
      }

      db.magnets.findOne({ magnet: u.query }, { sources: 1 }, function (err, doc) {
        if(err || !doc)
          r.end('[]');
        else
          r.end(JSON.stringify(doc.sources));
      });

      break;

    default:
      r.end('[]');
  }
});



//------------------------------------------------------------------------------
db.init(function () {
  server.listen(cfg.port, cfg.host);
},
function (n, e) {
  console.log('Error ' + n + ': ' + e);
  process.exit(1);
});



