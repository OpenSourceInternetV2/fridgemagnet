var _ = require('./config.js').main;

exports.host = function (host) {
  host = host.split('\.');

  var ext = '';
  while(host[host.length-1].length <= 3 && host.length >= 2)
    ext = host.splice(host.length-1, 1)[0] + '.' + ext;

  if(host.length >= 2)
    host = host.splice(1, host.length).join('.');
  else
    host = host[0];

  if(!ext.length)
    return host;

  return host + '.' + ext.substr(0, ext.length-1);
}


exports.log = function () {};
if(_.log)
  exports.log = function(v) { console.log(v.substr(0, 80)); }

