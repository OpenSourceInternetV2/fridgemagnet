
exports.main = {
  log: true,

  // maximums
  maxQueries: 100,        //maximum of queries
  maxRequests: 200,      //maximum crawler's parallel requests

  // quota
  quotaCount: 100,      //minimum of scanned before compare quota
  quotaR: 0.02,         //minmal quotient (score / number) to be relevant
  urlSize: 128,         //maximal size of an url


  banish:
    /twitter|facebook|linkedin|google|youtube|deezer|dailymotion|vimeo|identi.ca|wikipedia|amazon|ebay|imdb|vimeo|itunes|apple|manual|reference|rediff|myspace|hotmail|digg|thumblr|flickr|bbc\.co|(\.gov$)|reddit|adverti(s|z)ing|soir\.be|nytime/i,
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
  maxResults: 100,

  // comment it if non cross domain → Access-Control-Allow-Origin header's value
  CORS: '*',

  host: null,
  port: 8080,
}

