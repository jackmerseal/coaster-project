import * as dotenv from 'dotenv';
dotenv.config();
import debug from 'debug';
const debugMain = debug('app:Server');
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import {CoasterRouter} from '.routes/api/coaster.js';
import {ping} from './database.js'
import cookieParser from 'cookie-parser';
import {authMiddleware} from '@merlin4/express-auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cookieParser());
app.use(authMiddleware(process.env.JWT_SECRET, 'authToken', {
  httpOnly: true,
  maxAge: 1000 * 60 * 60,
}));