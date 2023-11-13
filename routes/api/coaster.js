import express from 'express';
const router = express.Router();

import debug from 'debug';
import { nanoid } from 'nanoid';
const debugCoaster = debug('app:CoasterRouter');
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

const newCoasterSchema = Joi.object({
  name: Joi.string().trim().required(),
  park: Joi.string().trim().required(),
  openingYear: Joi.number().integer().min(1700).max(2030).required(),
  manufacturer: Joi.string().trim().required(),
  length: Joi.string().trim().required(),
  height: Joi.string().trim().required(),
  drop: Joi.string().trim(),
  speed: Joi.string().trim().required(),
  inversions: Joi.number().integer().min(0).max(100),
  gForce: Joi.number().integer().min(0),
});

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
  debugCoaster(`Past max days old is ${pastMaxDaysOld}`);

  try {
    let coasters = await getCoasters();

    if(keywords){
      match.$text = {$search: keywords};
    }
    if(maxAge && minAge){
      match.creationDate = {$gte: pastMaxDaysOld, $lte: pastMinDaysOld};
    } else if(maxAge){
      match.creationDate = {$gte: pastMaxDaysOld};
    } else if(minAge){
      match.creationDate = {$lte: pastMinDaysOld};
    }
    switch (sortBy) {
      case 'name':
        sort = { name: 1, createdOn: 1 };
        break;
      case 'openingYear':
        sort = { openingYear: 1, createdOn: 1 };
        break;
      case 'manufacturer':
        sort = { manufacturer: 1, createdOn: 1 };
        break;
      case 'length':
        sort = { length: 1, createdOn: 1 };
        break;
      case 'height':
        sort = { height: 1, createdOn: 1 };
        break;
      case 'drop':
        sort = { drop: 1, createdOn: 1 };
        break;
      case 'speed':
        sort = { speed: 1, createdOn: 1 };
        break;
      case 'inversions':
        sort = { inversions: 1, createdOn: 1 };
        break;
      case 'gForce':
        sort = { gForce: 1, createdOn: 1 };
        break;
      default:
        sort = { name: 1, createdOn: 1 };
        break;
    }

    debugCoaster(`Sort is ${JSON.stringify(sort)}`);

    pageSize = parseInt(pageSize) || 5;
    pageNumber = parseInt(pageNumber) || 1;
    const skip = (pageNumber - 1) * pageSize;
    const limit = pageSize;
    debugCoaster(`Skip is ${skip}, limit is ${limit}`);
    const pipeline = [
      { $match: match },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ];

    const db = await connect();
    const cursor = await db.collection('Coasters').aggregate(pipeline);
    coasters = await cursor.toArray();
    res.status(200).json(coasters);
    
} catch(err) {
  debugCoaster(err);
  res.status(500).json({error: err});
}
}
);

router.post('/new', validBody(newCoasterSchema), async (req, res) => {
  const newCoaster = {
    _id: newId(),
    ...req.body,
    creationDate: new Date(),
  }
});
  

export {router as CoasterRouter};