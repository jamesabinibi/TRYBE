/**
 * cPanel / Phusion Passenger Entry Point
 * This file is recognized by cPanel's "Setup Node.js App" feature as the startup file.
 */
require('dotenv').config();

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 3000;

// Execute the production bundled server
require('./dist/server.cjs');
