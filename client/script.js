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
  showPub: function (v) {
    if(config('enable.sponsors') == 'true')
      $('sponsors-content').innerHTML = '<iframe src="sponsors.html"></iframe>';
    else
      $('sponsors-content').innerHTML = '<div>You have choosen to disable advertizing, we respect it, but don\'t forget it helps us to maintain this website</div>';
  },

  note: function (e, n) {
    //TODO: redo
    if(n && n.pon) {
      if(!n.nen)
        n.nen = 0;

      var note = parseInt(n.pon / (n.pon + n.nen) * 5);
      if(n < 0) n = 0;

      e.set('note', note)
       .set('noteN', n.nen)
       .set('noteP', n.pon);
    }
    else
      e.set('note', 0)
       .set('noteN', 0)
       .set('noteP', 0);
  },


  noteClick: function (e, n) {
    // this function is called by the HTML, e is the currentTarget
    if(e.parentNode.hasAttribute('noted'))
      return;

    e.parentNode.setAttribute('noted', '1');
    server.note(e.parentNode.getAttribute('infohash'), n);

    var s = {
      pon: parseInt(e.parentNode.getAttribute('noteP')),
      nen: parseInt(e.parentNode.getAttribute('noteN'))
    };

    if(n) s.pon++;
    else  s.nen++;

    ui.note(e.parentNode.parentNode.parentNode, s);
  },


  searchKey: function (e) {
    var v = $('search-input').value;
    if(e.keyCode == 13 && v.length) {
      if(v.search(/\s*magnet:\?/) == 0 && location.hash != '#magnet') {
        location.hash = 'magnet';
        $('src-input').focus();
      }
      else {
        server.search(v);
      }
    }
  },


  scroll: function (e) {
/*    if(!query.loading && !query.fail &&
       window.scrollY + window.innerHeight > document.body.clientHeight + 60)
      server.next();*/
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

      //TODO: move to top
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
  return r;
}


function humanSize (s) {
  if(s > 1000000000)
    return (parseInt(s/100000000)/10) + 'Gb';
  if(s > 1000000)
    return (parseInt(s/100000)/10) + 'Mb';
  if(s > 1000)
    return (parseInt(s/100)/10) + 'Kb';
  return s + ' bytes';
}


function magnetize (e) {
  var m = 'magnet:?xt=' + e._id;

  if(e.tr) {
    if(e.tr.splice)
      for(var i = 0; i < e.tr.length; i++)
        m += '&tr=' + encodeURIComponent(e.tr[i]);
    else
      m += '&tr=' + encodeURIComponent(e.tr);
  }

  if(e.dn)
    m += '&dn=' + encodeURIComponent(e.dn);

  return m;
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
    query.count = 0;

    if(!iu)
      iu = u;

    if(query.xhr)
      query.xhr.abort();

    document.body.setAttribute('search', '1');

    //FIXME: eventual conflict → verify current query before
    query.xhr = xhrGet(cfg.server + 'search/?' + u, function (rq) {
      query.xhr = null;
      if(iu != query.query)
        return;

      document.body.setAttribute('search', '2');

      var list = JSON.parse(rq.responseText);
      if(!list.length) {
        if(query.count)
          query.fail = true;
        else
          $('list').innerHTML = 'No result <big style="color:red;"><big>&#9785;</big></big>';
        query.loading = false;
        return;
      }

      list.sort(function (a, b) {
        return (((a.sta && a.sta.see) || 0) < ((b.sta && b.sta.see) || 0));
      });

      var fr = document.createDocumentFragment();
      for(var i = 0; i < list.length; i++) {
        var s = list[i].src;
        var r = '';

        if(s)
          for(var j = 0; j < s.length; j++)
            r += '<a href="' + s[j] + '">' + s[j] + '</a>';

        var sta = list[i].sta;
        var e = ui.item()
            .set('infohash', list[i]._id)
            .set('magnet', magnetize(list[i]))
            .set('name', list[i].dn)
            .set('sources', r)
            .set('seeders', (sta && sta.see) || 0)
            .set('leechers',  (sta && sta.lee) || 0)

        if(list[i].xl)
          e.set('size', humanSize(list[i].xl));

        ui.note(e, sta);

        fr.appendChild(e);
      }

      $('list').appendChild(fr);
      query.count = $('list').childNodes.length;
      $('n-results').innerHTML = query.count;

      query.loading = false;
    });
  },


  search: function (s, r) {
    query.search = s;
    query.query = 'q=' + encodeURIComponent(s);

    var v = $('src-input').value;
    if(!r && !v.length) {
      var stateObj = {};
      history.pushState(stateObj, s, '?' + query.query);
    }
    else if(v.length) {
      query.query += '&s=' + encodeURIComponent(v);
      $('src-input').value = '';
    }

    historic.push(s);

    if(location.hash)
      location.hash = '';

    $('search-input').value = s;
    $('list').innerHTML = '';
    $('n-results').innerHTML = '';
    this.search_(query.query);

    ui.showPub();
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
  $('src-input').addEventListener('keyup', ui.searchKey, false);
  //$('torrent-input').addEventListener('change', ui.torrentInput, false);

  document.addEventListener('scroll', ui.scroll, false);

  // search and stats
  xhrGet(cfg.server + 'stats', function (rq) {
    rq = JSON.parse(rq.responseText);
    $('stats').innerHTML = rq.m + ' magnets - ' + rq.s + ' pages / ' + rq.t;
  });

  //TODO: redo
  if(location.search && location.search.length > 1)
    server.search(decodeURIComponent(location.search.substr(3)), true);

  // other init
  config.init({ 'save.history': 'true', 'enable.sponsors': 'true' }, {
    'save.history': {
      id: 'cfg-history',
      prop: 'checked',
      cb: function (e, v) { if(!v || (e && !e.target.checked)) historic.clear(); } },
    'enable.sponsors': {
      id: 'cfg-sponsors',
      prop: 'checked',
      cb: function (e, v) { if(document.body.hasAttribute('search')) ui.showPub(); }
    },
  });
  historic.init();
}

