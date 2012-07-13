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

var cfg = {
  server: 'http://localhost:8080/',
  title: 'Da fridge',
}



/* REQUIRE: function $(i) { return document.getElementById(i); }
 * here in script.js
 */


function config (key, value) {
  if(config.arguments.length > 1) {
    localStorage.setItem(key, value);
    var e = config.watchers[key]
    if(e)
      e.o[e.p] = value;
    return value;
  }
  return localStorage.getItem(key);
}


config.set = function (key, value) {
  if(value.length && aValue != '') {
    config(key, value);
  }
  else
    config.remove(key);
}

config.remove = function (key) {
  localStorage.removeItem(key);
}

config.init = function (defaults, watchers) {
  var defaultTab;
  /*  TODO
   *  default.loadby
   *  plugins.*.enabled
   */
  if(!localStorage.length)
    for(var i in defaults)
      config(i, defaults[i]);

  if(watchers)
    for(var i in watchers) {
      var e = watchers[i];
      config.watch(i, e.id, e.prop, e.cb);
    }

/*  config.watch('save.history', 'cfg-history', 'checked', function (e) {
    if(!e.target.checked) {
      historic.clear();
      //config.remove('save.history');
    }
  });*/
}


config.watchers = [];
config.watch = function (key, id, prop, cb) {
  var o = $(id);

  o.addEventListener('change', function (evt) {
    config(key, evt.currentTarget[prop]);
    if(cb)
      cb(evt);
  }, false);

  this.watchers[key] = { o: o, p: prop};

  var e = config(key);
  if(e)
    o[prop] = (prop == 'checked') ? (e == 'true') : e;
}


