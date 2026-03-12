const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/pool');

const SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
];

// In-memory cache so we don't hit DB on every API call
let cachedRefreshToken = null;

function createOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

async function getRefreshToken() {
  if (cachedRefreshToken) return cachedRefreshToken;

  // Check DB first
  try {
    const { rows } = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'youtube_refresh_token'"
    );
    if (rows.length > 0 && rows[0].value) {
      cachedRefreshToken = rows[0].value;
      return cachedRefreshToken;
    }
  } catch (_) {
    // Table might not exist yet during init
  }

  // Fall back to env var
  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    cachedRefreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
    return cachedRefreshToken;
  }

  return null;
}

async function saveRefreshToken(token) {
  cachedRefreshToken = token;
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('youtube_refresh_token', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [token]
  );
}

async function getAuthenticatedClient() {
  const oauth2 = createOAuth2Client();
  const token = await getRefreshToken();
  if (token) {
    oauth2.setCredentials({ refresh_token: token });
  }
  return oauth2;
}

async function getYouTubeAnalytics() {
  return google.youtubeAnalytics({ version: 'v2', auth: await getAuthenticatedClient() });
}

async function getYouTubeData() {
  return google.youtube({ version: 'v3', auth: await getAuthenticatedClient() });
}

function getConsentUrl() {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

async function exchangeCode(code) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

async function isAuthenticated() {
  const token = await getRefreshToken();
  return !!token;
}

module.exports = {
  getYouTubeAnalytics,
  getYouTubeData,
  getConsentUrl,
  exchangeCode,
  getAuthenticatedClient,
  saveRefreshToken,
  isAuthenticated,
};
