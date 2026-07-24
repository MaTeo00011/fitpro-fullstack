const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbPassword = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : undefined;
const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: dbPassword,
  port: dbPort,
});

pool.on('error', err => {
  console.error('PostgreSQL pool error', err);
});

module.exports = pool;
