var dgram = require('dgram');
var qr = require('querystring');
var url = require('url');

var db = require('./db.js');  //initialized by the caller
var cfg = require('./config.js').search;
var _ = require('./config.js').main;


var trackers = {}
transactionID = parseInt(Math.random()*100000000);


function TrackerUDP (port, host) {
  this.port = port;
  this.host = host;

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
    delete trackers[this.host];

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
      var sta = s[i].sta;
      sta.see = m.readInt32BE(k);
      sta.lee = m.readInt32BE(k+8);

      db.magnets.update({ xt: s[i].xt }, { $set: {
        'sta.dat': sta.dat,
        'sta.see': sta.see,
        'sta.lee': sta.lee
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

    var s = box.list.splice(0, 25);
    var h = '';
    var i = 0;
    for(var i = 0; i < s.length; i++)
        h += s[i].xt.substr(s[i].xt.lastIndexOf(':')+1);

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

  var mt = Date.now() - _.cacheExpire;
  var ts = Date.now();
  var that = this;

  for(var i = 0; i < list.length; i++)
    try {
      var item = list[i];

      if(item.src && item.src.length > _.maxNSrc)
        item.src = item.src.splice(0, _.maxNSrc);

      if(!item.sta)
        item.sta = {};
      else
        if(item.sta.dat && item.sta.dat >= mt)
          continue;

      item.sta.dat = ts;
      item.sta.lee = 0;
      item.sta.see = 0;

      if(!item.tr)
          continue;

      this.list.push(item);
    }
    catch(e) {
      console.log(e);
    }

    if(!this.list.length) {
      cb(false);
      return;
    }

    for(var i in _.trackers) {
      if(!trackers[i])
        trackers[i] = new TrackerUDP(_.trackers[i], i);
      trackers[i].push(this);
    }
    this.tr = Object.keys(trackers).length;
}


TrackerBox.prototype = {
  cb: function (err, tr) {
    //  → if an error occures from a tracker, remove tracker from list, and if
    //  there is no more tracker, call cb
    //  → if there is no more elements in the list, call cb
    if(err) {
      --this.tr;
      if(this.tr > 0)
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

