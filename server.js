import * as dotenv from 'dotenv';
dotenv.config();
import debug from 'debug';
const debugMain = debug('app:Server');
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import {UserRouter} from './routes/api/user.js';
import {CoasterRouter} from './routes/api/coaster.js';
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

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use('/api/users', UserRouter);
app.use('/api/coasters', CoasterRouter);

app.get('/', (req, res) => {
  debugMain('Home Route hit');
  res.send('Home Route hit');
});

app.use((req,res) => {
  debugMain(`Sorry couldn't find ${req.originalUrl}`);
  res.status(404).json({error:`Sorry couldn't find ${req.originalUrl}`});
});

const port = process.env.PORT || 5001;

app.listen(port, () => {
  debugMain(`Listening on port http://localhost:${port}`);
});