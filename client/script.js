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
  item: null,
  historyItem: null,
}



//------------------------------------------------------------------------------
var historic = {
  init: function () {
    var l = config('list.history');
    if(!l)
      return;

    l = JSON.parse(l);
    for(var i = 0; i < l.length; i++)
      this.push_(l[i]);
  },

  clear: function () {
    var c = $('history');
    var l = c.childNodes;
    while(l.length)
      c.removeChild(l[0]);

    config.remove('list.history');
  },


  push: function (q) {
    var l = config('list.history');
    if(!l)
      config('list.history', JSON.stringify([q]));
    else {
      l = JSON.parse(l);

      if(l.indexOf(q) != -1)
        return;

      if(l.length > 15)
        l.splice(0,l.length-14);

      l.push(q);
      config('list.history', JSON.stringify(l));
    }

    this.push_(q);
  },


  push_: function (q) {
    var e = ui.historyItem();
    e.set('query', q);
    e.addEventListener('click', function () {
      search(q);
    }, false);

    var c = $('history');
    if(!c.childNodes.length)
      c.appendChild(e);
    else
      c.insertBefore(e, c.childNodes[0]);
  },
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

function percentDecode(q) {
  return q.replace(/%20/g, ' ').replace(/%21/g, '!').replace(/%23/g, '#')
          .replace(/%24/g, '$').replace(/%26/g, '&').replace(/%27/g, "'")
          .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2A/g, '*')
          .replace(/%2B/g, '+').replace(/%2C/g, ',').replace(/%2F/g, '/')
          .replace(/%3A/g, ':').replace(/%3B/g, ';').replace(/%3D/g, '=')
          .replace(/%3F/g, '?').replace(/%40/g, '@').replace(/%5B/g, '[')
          .replace(/%5D/g, ']');

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

    document.body.setAttribute('search', '1');

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
          .set('seeders', (list[i].stats && list[i].stats.seeders) || 0)
          .set('leechers',  (list[i].stats && list[i].stats.leechers) || 0)
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

  historic.push(s);
  $('search-input').value = s;
  $('list').innerHTML = '';
  search_(query.query);
}


function next () {
  search_(query.query + '&s=' + query.count, query.query);
}


function init() {
  // items:
  ui.item = parasol($('list-item'));
  ui.historyItem = parasol($('history-item'));

  // events:
  $('search-input').addEventListener('keyup', function (e) {
    if(e.keyCode == 13)
      search(e.target.value);
  }, false);


  $('filter-input').addEventListener('keyup', function (e) {
    var s = e.target.value;
    var l = $('list').childNodes;

    if(s.length) {
      s = RegExp(s, 'gi');
      for(var i = 0; i < l.length; i++)
        if(l[i].getAttribute('name').search(s) == -1)
          l[i].style.display = 'none';
        else
          l[i].style.display = 'block';
    }
    else
      for(var i = 0; i < l.length; i++)
        l[i].style.display = 'block';
  }, false);

  document.addEventListener('scroll', function (e) {
    if(!query.loading && !query.fail &&
       window.scrollY + window.innerHeight > document.body.clientHeight + 60)
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
    search(percentDecode(location.search.substr(3)), true);

  // other init
  config.init();
  historic.init();
}

