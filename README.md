fridgemagnet
============

nodejs - magnet search engine suite

this project requires mongodb to run. Configure the scripts using common/config.js


* crawler.js: run this script with the url list as arguments
* search.js: the search server; launch it and use client with a static http server


database
========

Magnets:
```json
{
  "xt":  "info hash",
  "dn":  "name",
  "tr":  "trackers",
  "kwd": "keywords",
  "src": "sources",
  "siz": "size of the torrent",
  "sta": {
    "see":  "seeders",
    "lee":  "leechers",
    "dat":  "last update",
    "pon":  "positives notes",
    "nen":  "negative notes",
  }
}
```




