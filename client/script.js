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
  return q; //.replace(/\W/g, '+');
}



//------------------------------------------------------------------------------
var query = {
  search: null,
  query: null,
};


function search_ (u, iu) {
  query.loading = true;
  query.fail = false;

  if(!iu)
    iu = u;

  //FIXME: eventual conflict → verify current query before
  xhrGet(cfg.server + 'search/?' + u, function (rq) {
    if(iu != query.query)
      return;

    $('dainput').setAttribute('search', '1');

    var list = JSON.parse(rq.responseText);
    if(!list.length) {
      if(query.count)
        query.fail = true;
      else
        $('list').innerHTML = '0 results :(';
      query.loading = false;
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

    $('list').appendChild(fr);
    query.count = $('list').childNodes.length;
    query.loading = false;
  });
}


function search (s, r) {
  query.search = s;
  query.query = 'q=' + percentEncode(s);

  if(!r) {
    var stateObj = {};
    history.pushState(stateObj, s, '?' + query.query);
  }

  $('list').innerHTML = '';
  search_(query.query);
}


function next () {
  search_(query.query + '&s=' + query.count, query.query);
}


function init() {
  // items:
  ui.item = parasol($('list-item'));

  // events:
  $('search-input').addEventListener('keyup', function (e) {
    if(e.keyCode == 13)
      search(e.target.value);
  }, false);

  document.addEventListener('scroll', function (e) {
    if(!query.loading && !query.fail &&
       window.scrollY + window.innerHeight > document.body.clientHeight - 80)
      next();

  }, false);


/*  document.body.addEventListener('keydown', function (e) {
    if(e.keyCode == 13 || e.target.tagName == 'INPUT' ||
       e.target.tagName == 'TEXTAREA')
      return;

    $('search-input').focus();
  }, true);*/

  // search and stats
  xhrGet(cfg.server + 'stats', function (rq) {
    rq = JSON.parse(rq.responseText);
    $('stats').innerHTML = rq.m + ' magnets - ' + rq.s + ' pages / ' + rq.t;
  });

  if(location.search && location.search.length > 1)
    search(location.search.substr(1), true);
}

