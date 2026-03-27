/*eslint-env jest*/

module.exports = {
  port: 3001,
  tokenSecret: 'interact-secret',
  db: {
    url: global.__MONGO_URI__,
    name: global.__MONGO_DB_NAME__,
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
}
