var db = require('./common/db.js');
var nma;
var t = 0;

function up () {
  var cur = db.magnets.find();

  cur.each(function(err, e) {
    e.xt = e._id;
    var k = e.kwd;

    delete e.kwd;
    delete e._id;

    nma.insert(e, function () {
      if(k.length)
        return;

      nma.findOne({ xt: e.xt }, { _id: 1 }, function (e, o) {
        if(e)
          return;
        for(var i = 0; i < k.length; i++)
          db.terms.update({ _id: k}, { $addToSet: { m: o._id }}, { upsert: true });
      });
    });

    t++;
    if(!(t%100)) console.log(t);
  });
}



db.init(function () {
  db.db.collection('nmagnets', function (err, coll) {
    if(err)
      return;

    nma = coll;
    up();
  });
}, function (n, e) {
  console.log(n, e);
});


