
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
  nRequest: 30,
  urlSize: 128,
  hostCount: 10000,
  hostScore: 1 / 10000,

/*  banish:
    /twitter|facebook|linkedin|google|youtube|deezer|dailymotion|vimeo|identi.ca|wikipedia|amazon|ebay|imdb|vimeo|itunes|apple|manual|reference|rediff|myspace|hotmail|digg|thumblr|flickr|bbc\.co|(\.gov$)|reddit|adverti(s|z)ing|soir\.be|nytime/i,*/
}

