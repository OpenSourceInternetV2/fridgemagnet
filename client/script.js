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
    if(e.keyCode == 13)
      server.search(e.target.value);
  },


  scroll: function (e) {
/*    if(!query.loading && !query.fail &&
       window.scrollY + window.innerHeight > document.body.clientHeight + 60)
      server.next();*/
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


function percentEncode(q) {
  return q.replace(/\s/g, '%20').replace(/\!/g, '%21').replace(/#/g, '%23')
          .replace(/\$/g, '%24').replace(/&/g, '%26').replace(/'/g, '%27')
          .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A')
          .replace(/\+/g, '%2B').replace(/,/g, '%2C').replace(/\//g, '%2F')
          .replace(/\:/g, '%3A').replace(/;/g, '%3B').replace(/=/g, '%3D')
          .replace(/\?/g, '%3F').replace(/@/g, '%40').replace(/\[/g, '%5B')
          .replace(/\]/g, '%5D');
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
        m += '&tr=' + percentEncode(e.tr[i]);
    else
      m += '&tr=' + percentEncode(e.tr);
  }

  if(e.dn)
    m += '&dn=' + percentEncode(e.dn);

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

        if(list[i].siz)
          e.set('size', humanSize(list[i].siz));

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
    query.query = 'q=' + percentEncode(s);

    if(!r) {
      var stateObj = {};
      history.pushState(stateObj, s, '?' + query.query);
    }

    historic.push(s);
    $('search-input').value = s;
    $('list').innerHTML = '';
    $('n-results').innerHTML = '';
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

