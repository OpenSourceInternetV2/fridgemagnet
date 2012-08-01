fridgemagnet
============

nodejs - magnet search engine suite

this project requires mongodb to run. Configure the scripts using common/config.js


* crawler.js: run this script with the url list as arguments
* search.js: the search server; launch it and use client with a static http server


database
========

magnets:
```json
{
  "xt":  "info hash",
  "dn":  "name",
  "tr":  "trackers",
  "xl": "size of the torrent",
  "src": "sources",
  "sta": {
    "see":  "seeders",
    "lee":  "leechers",
    "dat":  "last update",
    "pon":  "positives notes",
    "nen":  "negative notes",
  }
}
```

terms:
```json
{
  "_id": "term",
  "m": "Array of magnet id"
}
```


Todo
====
* detect common terms
* less bugs and better UI
* review cache management
* crawl using page scores
* ...

