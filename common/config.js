
exports.main = {
  log: true,

  // maximums
  maxQueries: 100,        //maximum of queries

  // trackers
  s2sTimeout: 60000,
  trackers: {
    'tracker.publicbt.com': 80,
    'tracker.ccc.de': 80,
    'tracker.istole.it': 80,
    'tracker.openbittorrent.com': 80,
  },

  // search
  cacheExpire: 2100000,
  maxNSrc: 5,

  // crawler
  maxRequests: 250,       //maximum crawler's parallel requests
  urlSize: 128,           //maximal size of an url
  banish:
    /127.0.0.1|localhost|lefrigo|paypal|github|twitter|facebook|linkedin|google|youtube|deezer|dailymotion|vimeo|identi.ca|wikipedia|amazon|ebay|imdb|vimeo|itunes|apple|manual|reference|rediff|myspace|hotmail|digg|thumblr|flickr|bbc\.co|(\.gov$)|reddit|adverti(s|z)ing|soir\.be|nytime/i,
}


exports.db = {
  db: 'magnetizor',
  host: 'localhost',
  port: 27017,
  options: {
    auto_reconnect: true,
    strict: false
  },
}


exports.search = {
  mongo21: true,
  maxResults: 100,
  trTimeout: 5000,

  // comment it if non cross domain → Access-Control-Allow-Origin header's value
  CORS: '*',

  host: null,
  port: 8080,
}

