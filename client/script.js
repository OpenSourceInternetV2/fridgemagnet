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


  // Methods:
  note: function (e, n) {
    if(n && n.note && n.count)
      e.set('note', parseInt(n.note / n.count * 5))
       .set('noteN', n.note)
       .set('noteT', n.count);
    else
      e.set('note', 0)
       .set('noteN', 0)
       .set('noteT', 0);
  },


  filterKey: function (e) {
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
  },


  noteClick: function (e, n) {
    // this function is called by the HTML, e is the currentTarget
    if(e.parentNode.hasAttribute('noted'))
      return;

    e.parentNode.setAttribute('noted', '1');
    server.note(e.parentNode.getAttribute('magnet'), n);

    var s = {
      count: parseInt(e.parentNode.getAttribute('noteT')) + 1,
      note: parseInt(e.parentNode.getAttribute('noteN'))
    };

    if(n)
      s.note++;

    ui.note(e.parentNode.parentNode.parentNode, s);
  },


  searchKey: function (e) {
    if(e.keyCode == 13)
      server.search(e.target.value);
  },


  scroll: function (e) {
    if(!query.loading && !query.fail &&
       window.scrollY + window.innerHeight > document.body.clientHeight + 60)
      server.next();
  },


  torrentInput: function (e) {
    var l = e.currentTarget.files;

    for(var i = 0; i < l.length; i++)
      torrentFile.magnetize(l[i]);
  },
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
    if(config('save.history') != 'true')
      return;

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
      server.search(q);
    }, false);

    var c = $('history');
    if(!c.childNodes.length)
      c.appendChild(e);
    else
      c.insertBefore(e, c.childNodes[0]);
  },
}


//------------------------------------------------------------------------------
var torrentFile = {
  bdecode: function (d) {
    var o;

  },

  magnetize: function (f) {
    var r = FileReader();
    r.readAsBinaryString(f);
    var d = r.result;

    var i = 0;
    function _s() {
      var j = d.indexOf(':', i);
      if(j==-1 || d[i] == '0' && j != i+1)
        throw "invalid string";

      var s = parseInt(d.substring(i,j));
      i = j+s+1;
      s = d.substring(j+1, i);
      i++;
      return s;
    }

    function _i() {
      var j = d.indexOf('e', i);
      if(j == -1)
        throw "invalid integer";
      j = parseInt(d.substring(i,j));
      i = j+1;
      return j;
    }

    function _d() {
      var l = [];
      while(d[i] != 'e' && i <= d.length) {

      }
    }

    for(; i < d.length; i++) {
      var c = d[i];
      switch(c) {
        case 'd':
          ;
      }
    }
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
  return q.replace(' ', '%20').replace('!', '%21').replace('#', '%23')
          .replace('$', '%24').replace('&', '%26').replace("'", '%27')
          .replace('(', '%28').replace(')', '%29').replace('*', '%2A')
          .replace('+', '%2B').replace(',', '%2C').replace('/', '%2F')
          .replace(':', '%3A').replace(';', '%3B').replace('=', '%3D')
          .replace('?', '%3F').replace('@', '%40').replace('[', '%5B')
          .replace(']', '%5D');
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


var server = {
  search_: function (u, iu) {
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

        var stats = list[i].stats;
        var e = ui.item()
            .set('magnet', list[i].magnet)
            .set('name', list[i].name)
            .set('sources', r)
            .set('seeders', (stats && stats.seeders) || 0)
            .set('leechers',  (stats && stats.leechers) || 0)

        ui.note(e, stats);

        fr.appendChild(e);
      }

      $('list').appendChild(fr);
      query.count = $('list').childNodes.length;
      query.loading = false;
    });
  },


  search: function (s, r) {
    query.search = s;
    query.query = 'q=' + percentEncode(s);

    if(!r) {
      var stateObj = {};
      history.pushState(stateObj, s, '?' + query.query);
    }

    historic.push(s);
    $('search-input').value = s;
    $('list').innerHTML = '';
    this.search_(query.query);
  },


  note: function (m, n) {
    xhrGet(cfg.server + 'note/' + (n ? 1 : -1) + '/?' + m,
      function (){});
  },


  next: function () {
    this.search_(query.query + '&s=' + query.count, query.query);
  }
}


function init() {
  window.scroll(0, 0);

  // items:
  ui.item = parasol($('list-item'));
  ui.historyItem = parasol($('history-item'));

  // events:
  $('search-input').addEventListener('keyup', ui.searchKey, false);
  $('filter-input').addEventListener('keyup', ui.filterKey, false);
  //$('torrent-input').addEventListener('change', ui.torrentInput, false);

  document.addEventListener('scroll', ui.scroll, false);

  // search and stats
  xhrGet(cfg.server + 'stats', function (rq) {
    rq = JSON.parse(rq.responseText);
    $('stats').innerHTML = rq.m + ' magnets - ' + rq.s + ' pages / ' + rq.t;
  });

  if(location.search && location.search.length > 1)
    server.search(percentDecode(location.search.substr(3)), true);

  // other init
  config.init({ 'save.history': 'true' }, {
    'save.history': {
      id: 'cfg-history',
      prop: 'checked',
      cb: function (e) { if(!e.target.checked) historic.clear(); } }
  });
  historic.init();
}

