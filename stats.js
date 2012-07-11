var dgram = require('dgram');
var db = require('./common/db.js');
var cfg = require('./common/config.js').stats;


function Session (url, port, hash, cb) {
  this.u = url;
  this.p = port;
  this.h = hash;
  this.c = cb;
  this.n = 0;

  var s = this;
  this.s = dgram.createSocket('udp4', function (m, r) {
    console.log('<      ', m);
    s.next(m, r);
  })
  .on('close', function () {
    console.log('### socket closed ###');
  });

  s.next();
}

Session.prototype = {
  next: function (m, r) {
    this['step' + this.n ](m, r);
    this.n++;
  },


  decode: function(m) {
    return {
      transaction: m.slice(4),
      action: m.slice(4),
      id: m.slice(8),
    }
  },


  check: function(m, r) {
    if(m.readInt32LE(0) == 3) {
      console.log('error :', m.toString());
      this.s.close();
      return true;
    }

    var tr = m.readInt32LE(4);
    if(tr != this.tr) {
      console.log('not same transaction id ' + tr + ' but should be ' + this.tr);
      this.s.close();
      return true;
    }
  },


  action: function (a, d) {
    this.tr = parseInt(Math.random()*100000000);
    var b = new Buffer(8);
    b.writeInt32LE(a, 0);         //action
    b.writeInt32LE(this.tr, 4);   //transaction id

    if(!d)
      b = Buffer.concat([this.id, b]);
    else
      b = Buffer.concat([this.id, b, d]);

    console.log('> ', b.length, ' ', b);
    this.s.send(b, 0, b.length, this.p, this.u,
    function(e, b) {
      if(e)
        console.log('error: ' + e);
    });
  },


  step0: function (m, r) {
    this.id = new Buffer([0x00, 0x00, 0x04, 0x17, 0x27, 0x10, 0x19, 0x80]);
    this.action(0);
  },


  step1: function (m, r) {
    if(this.check(m, r))
      return;

    this.id = this.decode(m).id;
    console.log('Connection id: ', this.id);

    console.log(this.h);
    this.action(2, new Buffer(this.h));
  },


  step2: function (m, r) {
    if(this.check(m, r))
      return;

    if(this.cb)
      this.cb(this);
  },
}



var s = new Session( "tracker.istole.it", 80,
  "c635de93045eb00d82aeaba77cb7df08a649a888");





