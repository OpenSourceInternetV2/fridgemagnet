var qr = require('querystring');
var crypto = require('crypto');
var bencode = require('./bencode.js');

function decode (d) {
  var o = bencode.decode(d);
  if(!o.info)
    return;

  //hash
  var hash = (o['magnet-info'] && o['magnet-info'].info_hash);
  if(hash)
    hash = hash.toString('hex');
  else
    hash = crypto.createHash('sha1').update(bencode.encode(o.info)).digest('hex');

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
    infohash: hash,
    size: size,
    name: name,
    magnet: 'magnet:?xt=urn:btih:' + hash + '&' +
      qr.stringify({
        'tr' : ann,
        'dn' : name,
      })
  };
}

exports.decode = decode;


