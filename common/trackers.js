var dgram = require('dgram');
var qr = require('querystring');
var url = require('url');

var db = require('./db.js');  //initialized by the caller
var cfg = require('./config.js').search;


var trackers = {}
transactionID = parseInt(Math.random()*100000000);


function TrackerUDP (port, host, url) {
  this.port = port;
  this.host = host;
  this.url = url;

  this.boxes = [];

  this.sock = dgram.createSocket('udp4');
  this.cnID_ = new Buffer([0x00, 0x00, 0x04, 0x17, 0x27, 0x10, 0x19, 0x80]);
  this.success = false;

  var sock = this.sock;
  var that = this;
  sock.on('message', function(m) {
    tm = false;
    var d = {
      action: m.readInt32BE(0),
      transaction: m.readInt32BE(4),
    };

    if(d.transaction != that.trID) {
      sock.close();
      return;
    }

    switch(d.action) {
      case 0:
        that.cnID = m.slice(8);
        that.scrap();
        break;
      case 2:
        that.onScrap(m);
        break;
      case 3:
        if(!that.cnID) {
          that.close(true);
          return;
        }

        that.cnID = null;
        that.action(0);
        break;
    }
  })
  .on('close', function () {
    that.close(true);
  })
  .on('error', function () {
    that.close(true);
  });

  this.action(0);
}

TrackerUDP.prototype = {
  close: function (err) {
    delete trackers[this.url];

    for(var i = 0; i < this.boxes.length; i++)
      this.boxes[i].cb(err, this);

    try {
      this.sock.close();
    } catch(e) {}
  },


  action: function (a, d) {
    this.trID = ++transactionID;
    var b = new Buffer(8);

    b.writeInt32BE(a, 0);             //action
    b.writeInt32BE(this.trID, 4);   //transaction id

    if(!d)
      b = Buffer.concat([this.cnID || this.cnID_, b]);
    else
      b = Buffer.concat([this.cnID, b, d]);

    this.sock.send(b, 0, b.length, this.port, this.host,
      function(e, b) {
        if(e)
          console.log('error: ' + e);
      });
  },


  onScrap: function (m) {
    var s = this.stack;
    for(var i = 0, k = 8; i < s.length; i++, k+=12) {
      var stats = s[i].stats;
      stats.seeders = m.readInt32BE(k);
      stats.leechers = m.readInt32BE(k+8);

      db.magnets.update({ infohash: s[i].infohash }, { $set: {
        'stats.date': stats.date,
        'stats.seeders': stats.seeders,
        'stats.leechers': stats.leechers
      }});
    }

    if(!this.box.list.lengt) {
      this.boxes.shift();
      this.box.cb();
      this.box = null
    }

    this.scrap();
  },


  scrap: function () {
    //TODO: delete me if not this.boxes → update conn id
    if(this.box || !this.boxes.length || !this.cnID)
      return;

    var box = this.boxes[0];
    if(!box.list.length) {
      this.boxes.shift();
      this.scrap();
      return;
    }

    var s = [];
    var l = box.list;
    var h = '';
    for(var i = 0; i < l.length && s.length < 25; i++)
      if(l[i].trackers.indexOf(this.url) != -1) {
        h += l[i].infohash.substr(l[i].infohash.lastIndexOf(':')+1);
        s = s.concat(l.splice(i, 1));
        i--;
      }

    this.box = box;
    this.stack = s;
    this.action(2, new Buffer(h, 'hex'));
  },


  push: function (box) {
    this.boxes.push(box);
    this.scrap();
  },
}



//------------------------------------------------------------------------------
function TrackerBox (list, cb) {
  this.cb_ = cb;
  this.list = [];
  this.tr = {};

  var mt = parseInt(Date.now()/1000) - 2100;
  var ts = parseInt(Date.now()/1000);
  var that = this;

  for(var i = 0; i < list.length; i++)
    try {
      var item = list[i];

      if(!item.stats)
        item.stats = {};
      else
        if(item.stats.date && item.stats.date >= mt)
          continue;

      item.stats.date = ts;
      item.stats.leechers = 0;
      item.stats.seeders = 0;

      if(!item.trackers) {
        var m = qr.parse(item.magnet);
        if(!m.tr)
          continue;

        db.magnets.update({ infohash: item.infohash }, { $set: { trackers: m.tr }});
        item.trackers = m.tr;
      }

      this.list.push(item);

      for(var j = 0; j < item.trackers.length; j++) {
        var t = item.trackers[j];
        var p;
        if(this.tr[t] || (p = url.parse(t)).protocol != 'udp:')
          continue;

        if(!trackers[t])
          trackers[t] = new TrackerUDP(p.port, p.hostname, t);

        this.tr[t] = trackers[t];
      }
    }
    catch(e) {
      console.log(e);
    }


    if(!Object.keys(this.tr).length) {
      cb(false);
      return;
    }

    for(var i in this.tr)
      this.tr[i].push(this);
}


TrackerBox.prototype = {
  cb: function (err, tr) {
    //  → if an error occures from a tracker, remove tracker from list, and if
    //  there is no more tracker, call cb
    //  → if there is no more elements in the list, call cb
    if(err) {
      delete this.tr[tr.url];
      if(Object.keys(this.tr).length)
        return;
    }
    else if(this.list.length)
      return;

    this.cb_(err);
  }
}



exports.trackers = trackers;
exports.TrackerUDP = TrackerUDP;
exports.TrackerBox = TrackerBox;

