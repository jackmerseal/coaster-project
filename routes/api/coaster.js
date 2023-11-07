import express from 'express';
const router = express.Router();

import debug from 'debug';
import { nanoid } from 'nanoid';
const debugUser = debug('app:UserRouter');
import {
  connect,
  getCoasters,
  newId,
} from '../../database.js';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import {validCoasterId} from '../../middleware/validCoasterId.js';
import {validBody} from '../../middleware/validBody.js';

router.use(express.urlencoded({extended: false}));

router.get('/list', async (req, res) => {

  let { keywords, maxAge, minAge, sortBy, pageSize, pageNumber } =
    req.query;
  const match = {};
  let sort = { givenName: 1 };

  let today = new Date();
  today.setHours(0);
  today.setMinutes(0);
  today.setSeconds(0);
  today.setMilliseconds(0);

  const pastMaxDaysOld = new Date();
  pastMaxDaysOld.setDate(pastMaxDaysOld.getDate() - maxAge);

  const pastMinDaysOld = new Date();
  pastMinDaysOld.setDate(pastMinDaysOld.getDate() - minAge);
  debugUser(`Past max days old is ${pastMaxDaysOld}`);

})