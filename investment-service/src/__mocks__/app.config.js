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
  auth: {
    jwtSecret: 'test-jwt-secret-key-for-testing-purposes',
    jwtExpiresIn: '24h',
    bcryptSaltRounds: 10,
    maxLoginAttempts: 5,
    lockDurationMinutes: 15,
    resetTokenTTLSeconds: 3600,
    sessionTTLSeconds: 86400,
  },
  google: {
    clientId: 'test-google-client-id',
    clientSecret: 'test-google-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
}
