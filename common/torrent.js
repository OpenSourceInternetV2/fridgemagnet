var qr = require('querystring');
var crypto = require('crypto');
var bencode = require('./bencode.js');

exports.decode = function (d) {
  var o = bencode.decode(d);
  if(!o.info)
    return;

  //hash
  var hash = (o['magnet-info'] && o['magnet-info'].info_hash);
  if(hash)
    hash = hash.toString('hex');
  else
    hash = crypto.createHash('sha1').update(bencode.encode(o.info)).digest('hex');
  hash = 'urn:btih:' + hash;

  //size
  var size = 0;
  var l = o.info.files;
  if(l)
    for(var i = 0; i < l.length; i++)
      size += l[i].length || 0;
  else
    size = o.info.length;

  //announces
  var ann = [];
  if(o.announce)
    ann.push(o.announce);

  l = o['announce-list'];
  if(l)
    for(var i = 0; i < l.length; i++)
      ann.push(l[i][0].toString());

  //name
  var name = ((o['magnet-info'] && o['magnet-info']['display-name']) || o.info.name).toString();

  //return
  return {
    _id: 'urn:btih:' + hash ,
    dn: name,
    tr : ann,
    xl: size,
    kwd: name.toLowerCase().match(/(\w)+/gi)
  };
}


