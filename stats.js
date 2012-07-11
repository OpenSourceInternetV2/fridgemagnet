var dgram = require('dgram');
//var db = require('./common/db.js');
//var cfg = require('./common/config.js').stats;

transaction_id = parseInt(Math.random()*100000000);


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
    var d = {
      action: m.readInt32BE(0),
      transaction: m.readInt32BE(4),
    };

    if(d.transaction != this.tr) {
      console.log('not same transaction id ' + d.transaction + ' but should be ' + this.tr);
      this.s.close();
      return;
    }

    switch(d.action) {
      case 0:
        d.id = m.slice(8);
        break;

      case 2:
        var _ = (m.length - 8) / 3;
        var s = 8 + 0;
        var l = 8 + 2 * _;

        d.stats = [];

        for(var i = 0; i < _; i+=4) {
          d.stats.push({
            seeders:  m.readInt32BE(s),
            leechers: m.readInt32BE(l)
          });

          s+= 4;
          l+= 4;
        }
        break;

      case 3:
        d.error = m;
        console.log('! ', m.toString());
        this.s.close();
        return;
    }
    return d;
  },


  action: function (a, d) {
    this.tr = ++transaction_id;
    var b = new Buffer(8);
    b.writeInt32BE(a, 0);         //action
    b.writeInt32BE(this.tr, 4);   //transaction id

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
    var d = this.decode(m);
    if(!d) return;

    this.id = d.id;
    console.log('# ', this.id);

    this.action(2, new Buffer(this.h, 'hex'));
  },


  step2: function (m, r) {
    var d = this.decode(m);
    if(!d) return;

    console.log(d.stats);

    if(this.cb)
      this.cb(this);
  },
}


var s = new Session( "tracker.ccc.de", 80,
"83e73056ed2774734105dec4a9156ef5fbeca1b3" );
//  "c635de93045eb00d82aeaba77cb7df08a649a888")





