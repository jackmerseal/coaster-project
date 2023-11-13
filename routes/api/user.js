import express from 'express';
const router = express.Router();

import debug from 'debug';
import { nanoid } from 'nanoid';
const debugUser = debug('app:UserRouter');
import {
  connect,
  getUsers,
  getUserById,
  registerUser,
  loginUser,
  updateUser,
  deleteUser,
  updateMe,
  saveEdit,
  newId,
  findRoleByName,
} from '../../database.js';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { validUserId } from '../../middleware/validUserId.js';
import { validBody } from '../../middleware/validBody.js';
import { isLoggedIn, fetchRoles, mergePermissions, hasAnyRole, hasRole, hasPermission } from '@merlin4/express-auth';

//import { ObjectId } from 'mongodb';

router.use(express.urlencoded({ extended: false }));

async function issueAuthToken(user) {
  const payload = { _id: user._id, email: user.email, role: user.role };
  const secret = process.env.JWT_SECRET;
  const options = { expiresIn: '1h' };

  const roles = await fetchRoles(user, role => findRoleByName(role));

  const permissions = mergePermissions(user, roles);
  payload.permissions = permissions;
  debugUser(`Permissions are ${JSON.stringify(permissions)}`);
  const authToken = jwt.sign(payload, secret, options);
  return authToken;
}

function issueAuthCookie(res, authToken) {
  const cookieOptions = { httpOnly: true, maxAge: 1000 * 60 * 60 };
  res.cookie('authToken', authToken, cookieOptions);
}

const registerUserSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().trim().min(5).max(50).required(),
  fullName: Joi.string().trim().min(1).max(50).required(),
  role: Joi.string()
    .trim()
    .valid(
      'Guest',
      'Ride Operator',
      'Maintenance Supervisor',
    ),
});

const loginUserSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().trim().min(5).max(50).required(),
});

const updateUserSchema = Joi.object({
  password: Joi.string().trim().min(5).max(50),
  fullName: Joi.string().trim().min(1).max(50),
});

router.post('/register', validBody(registerUserSchema), async (req, res) => {
  const newUser = {
    _id: newId(),
    ...req.body,
    creationDate: new Date(),
    //role: ['Developer'],
  };

  newUser.password = await bcrypt.hash(newUser.password, 10);
  try {
    const result = await registerUser(newUser);

    if (result.invalidFields) {
      res.status(400).json({ message: `Invalid data!` });
    }

    if (result.duplicateEmail) {
      res.status(400).json({ message: `User already registered!` });
    }

    if (result.insertResult) {
      const edit = {
        timeStamp: new Date(),
        op: 'Register',
        collection: 'User',
        target: newUser._id,
        update: newUser,
        auth: req.auth,
      };
      await saveEdit(edit);

      const authToken = await issueAuthToken(newUser);
      issueAuthCookie(res, authToken);
      res.status(200).json({
        message: `New user ${newUser.fullName} registered. Your auth token is ${authToken}`,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }

  debugUser(newUser);
  //FIXME: Register new user and send response as JSON
});

router.post('/login', validBody(loginUserSchema), async (req, res) => {
  const user = req.body;

  try {
    const resultUser = await loginUser(user);
    debugUser(resultUser);

    if (
      resultUser &&
      (await bcrypt.compare(user.password, resultUser.password))
    ) {
      const authToken = await issueAuthToken(resultUser);
      issueAuthCookie(res, authToken);
      res
        .status(200)
        .json(
          `Welcome back, ${resultUser.fullName}. Your auth token is ${authToken}`
        );
    } else {
      res
        .status(400)
        .json(`Invalid login credentials provided. Please try again.`);
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.get('/list', isLoggedIn(), hasPermission('canViewData'), async (req, res) => {
  debugUser(
    `Getting all users, the query string is ${JSON.stringify(req.query)}`
  );

  let { keywords, role, maxAge, minAge, sortBy, pageSize, pageNumber } =
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

  try {
    let users = await getUsers();

    if (keywords) {
      match.$text = { $search: keywords };
    }
    if (role) {
      match['role'] = role;
    }
    if (maxAge && minAge) {
      match.creationDate = { $lte: pastMinDaysOld, $gte: pastMaxDaysOld };
    } else if (maxAge) {
      match.creationDate = { $gte: pastMaxDaysOld };
    } else if (minAge) {
      match.creationDate = { $lt: pastMinDaysOld };
    }
    switch (sortBy) {
      case 'fullName':
        sort = { fullName: 1, createdOn: 1 };
        break;
      case 'role':
        sort = { role: 1, fullName: 1, createdOn: 1 };
        break;
      case 'newest':
        sort = { createdOn: -1 };
        break;
      case 'oldest':
        sort = { createdOn: 1 };
        break;
      default:
        sort = { fullName: 1, createdOn: 1 };
        break;
    }

    debugUser(`Sort is ${JSON.stringify(sort)}`);

    pageSize = parseInt(pageSize) || 5;
    pageNumber = parseInt(pageNumber) || 1;
    const skip = (pageNumber - 1) * pageSize;
    const limit = pageSize;
    debugUser(`Skip is ${skip}, limit is ${limit}`);
    const pipeline = [
      { $match: match },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ];

    const db = await connect();
    const cursor = await db.collection('User').aggregate(pipeline);
    users = await cursor.toArray();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.get('/me', isLoggedIn(), async (req, res) => {
  const id = req.auth._id;
  try {
    const user = await getUserById(id);
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: `User ${id} not found` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.get(
  '/:userId',
  isLoggedIn(),
  hasPermission('canViewData'),
  validUserId('userId'),
  async (req, res) => {
    //Read the userId from the URL and stores in a variable
    const userId = req.userId;
    try {
      const user = await getUserById(userId);
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ message: `User ${userId} not found` });
      }
    } catch (err) {
      res.status(500).json({ error: err.stack });
    }
  }
);

router.put(
  '/update/me',
  isLoggedIn(),
  validBody(updateUserSchema),
  async (req, res) => {
    debugUser(`Update user route hit ${JSON.stringify(req.auth)}`);
    const updatedUser = req.body;

    try {
      const user = await getUserById(newId(req.auth._id));
      if (user) {
        if (updatedUser.password) {
          user.password = await bcrypt.hash(updatedUser.password, 10);
        }
        if (updatedUser.fullName) {
          user.fullName = updatedUser.fullName;
        }
        if (updatedUser.givenName) {
          user.givenName = updatedUser.givenName;
        }
        if (updatedUser.familyName) {
          user.familyName = updatedUser.familyName;
        }
        const dbResult = await updateMe(user);
        if (dbResult.modifiedCount == 1) {
          const edit = {
            timeStamp: new Date(),
            op: 'Self-Edit Update User',
            collection: 'User',
            target: user._id,
            update: updatedUser,
            auth: req.auth,
          };
          await saveEdit(edit);
          res.status(200).json({ message: `User ${req.auth._id} updated!` });
          return;
        } else {
          res
            .status(400)
            .json({ message: `User ${req.auth._id} not updated.` });
          return;
        }
      } else {
        res.status(400).json({ message: `User ${req.auth._id} not updated.` });
      }
    } catch (err) {
      res.status(500).json({ error: err.stack });
    }
  }
);

router.put(
  '/update/:userId',
  isLoggedIn(),
  hasPermission('canEditAnyUser'),
  validUserId('userId'),
  validBody(updateUserSchema),
  async (req, res) => {
    const updatedUser = req.body;
    const user = await getUserById(req.userId);

    try {
      if (user) {
        if (updatedUser.password) {
          user.password = await bcrypt.hash(updatedUser.password, 10);
        }
        if (updatedUser.fullName) {
          user.fullName = updatedUser.fullName;
        }
        if (updatedUser.givenName) {
          user.givenName = updatedUser.givenName;
        }
        if (updatedUser.familyName) {
          user.familyName = updatedUser.familyName;
        }
        if (updatedUser.role) {
          user.role = updatedUser.role;
        }
        user.lastUpdatedOn = new Date();
        user.lastUpdatedBy = req.fullName;

        const dbResult = await updateUser(user._id, user);
        if (dbResult.modifiedCount == 1) {
          const edit = {
            timeStamp: new Date(),
            op: 'Admin Update User',
            collection: 'User',
            target: user._id,
            update: updatedUser,
            auth: req.auth,
          };
          await saveEdit(edit);
          res.status(200).json({ message: `User ${req.userId} updated!` });
          return;
        } else {
          res.status(400).json({ message: `User ${req.userId} not updated.` });
          return;
        }
      } else {
        res.status(400).json({ message: `User ${req.userId} not updated.` });
      }
    } catch (err) {
      res.status(500).json({ error: err.stack });
    }
  }
);

router.delete(
  '/:userId',
  isLoggedIn(),
  hasPermission('canEditAnyUser'),
  validUserId('userId'),
  async (req, res) => {
    const id = req.userId;
    try {
      const dbResult = await deleteUser(id);
      if (dbResult.deletedCount == 1) {
        const edit = {
          timeStamp: new Date(),
          op: 'Delete',
          collection: 'User',
          target: id,
          auth: req.auth,
        };
        await saveEdit(edit);
        res.status(200).json({ message: `User ${id} deleted!` });
      } else {
        res.status(404).json({ message: `User ${id} not deleted!` });
      }
    } catch (err) {
      res.status(500).json({ error: err.stack });
    }
  }
);

export { router as UserRouter };
