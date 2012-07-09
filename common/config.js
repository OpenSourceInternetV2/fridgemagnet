
exports.db = {
  db: 'magnetizor',
  host: 'localhost',
  port: 27017,
  options: {
    auto_reconnect: true,
    strict: false
  },
}


exports.crawler = {
  log: true,
  nRequests: 15,
  urlSize: 128,
  hostCount: 100,
  hostScore: 1 / 100,

  banish:
    /twitter|facebook|linkedin|google|youtube|deezer|dailymotion|vimeo|identi.ca|wikipedia|amazon|ebay|imdb|vimeo|itunes|apple|manual|reference|rediff|myspace|hotmail|digg|thumblr|flickr|bbc\.co|(\.gov$)|reddit|adverti(s|z)ing|soir\.be|nytime/i,
}


exports.metadata = {
  log: true,
  nRequests: 30,
}


exports.search = {
  log: true,
  nRequest: 100,
  maxResults: 100,

  // comment it if non cross domain → Access-Control-Allow-Origin header's value
  CORS: '*',

  host: null,
  port: 8080,
}

