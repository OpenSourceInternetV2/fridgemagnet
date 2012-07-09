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

function $(i) {
  return document.getElementById(i);
}

var ui = {
  item: null
}


//------------------------------------------------------------------------------
function xhrGet(url, onSuccess, onFail) {
  var r = new XMLHttpRequest();
  if(!r)
    alert("your navigator sucks. try with a newer one, like firefox");

  var req = this;
  r.onreadystatechange = function () {
    if(r.readyState != 4)
      return;

    if(r.status === 200 || r.status === 0)
      onSuccess(r);
    else if(onFail)
      onFail(r);
  }

  r.open('get', url, true);
  r.send();
}

function percentEncode(q) {
  return q.replace(/\W/g, '+');
}




function search_ (u) {
  //FIXME: eventual conflict → verify current query before
  xhrGet(cfg.server + 'search/?' + u, function (rq) {
    location.hash = "#" + u;
    $('dainput').setAttribute('search', '1');

    var list = JSON.parse(rq.responseText);
    if(!list.length) {
      $('list').innerHTML = '0 results :(';
      return;
    }

    var fr = document.createDocumentFragment();
    for(var i = 0; i < list.length; i++) {
      var s = list[i].sources;
      var r = '';
      for(var j = 0; j < s.length; j++)
        r += '<a href="' + s[j] + '">' + s[j] + '</a>';

      fr.appendChild(
        ui.item()
          .set('magnet', list[i].magnet)
          .set('name', list[i].name)
          .set('sources', r)
      );
    }

    $('list').innerHTML = '';
    $('list').appendChild(fr);
  });
}

function search (q, s, l) {
  var u = 'q=' + percentEncode(q);

  if(s) u += '&s=' + s;
  if(l) u += '&l=' + l;

  search_(u);
}




function init() {
  // items:
  ui.item = parasol($('list-item'));

  // events:
  $('search-input').addEventListener('keyup', function (e) {
    if(e.keyCode == 13)
      search(e.target.value);
  }, false);

  // search and stats
  xhrGet(cfg.server + 'stats', function (rq) {
    rq = JSON.parse(rq.responseText);
    $('stats').innerHTML = rq.m + ' magnets - ' + rq.s + ' pages / ' + rq.t;
  });

  if(location.hash && location.hash.length > 1) {
    search_(location.hash.substr(1));
  }
}

