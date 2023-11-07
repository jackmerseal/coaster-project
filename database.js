import * as dotenv from 'dotenv';
dotenv.config();

import {MongoClient, ObjectId} from 'mongodb';
import debug from 'debug';

const debugDb = debug('app:Database');

const newId = (str) => new ObjectId(str);

let _db = null;

async function connect() {
  if(!_db){
    const dbUrl = process.env.DB_URL;
    const dbName = process.env.DB_NAME;
    const client = await MongoClient.connect(dbUrl);
    _db = client.db(dbName);
    debugDb('Connected');
  }
  return _db;
}

async function ping(){
  const db = await connect();
  await db.command({ping: 1});
  debugDb('Ping');
}

async function getUsers() {
  const db = await connect();
  const users = await db.collection('User').find({}).toArray();
  return users;
}

async function getUserById(id) {
  const db = await connect();
  const user = await db.collection('User').findOne({ _id: new ObjectId(id) });
  return user;
}

async function registerUser(user) {
  const db = await connect();

  let inValidFields = '';
  if (!user.email) {
    inValidFields += 'Email, ';
  }
  if (!user.password) {
    inValidFields += 'Password, ';
  }
  if (!user.fullName) {
    inValidFields += 'Full name, ';
  }
  if (!user.givenName) {
    inValidFields += 'Given name, ';
  }
  if (!user.familyName) {
    inValidFields += 'Family name, ';
  }
  if (!user.role) {
    inValidFields += 'Role, ';
  }

  if (inValidFields != '') {
    return { invalidFields: inValidFields };
  }
  const foundUser = await db.collection('User').findOne({ email: user.email });

  if (foundUser == null) {
    const registeredUser = await db.collection('User').insertOne(user);
    return { insertResult: registeredUser, duplicateEmail: false };
  } else {
    return { duplicateEmail: true };
  }
}

async function loginUser(user) {
  const db = await connect();
  const resultUser = await db
    .collection('User')
    .findOne({ email: user.email});
    return resultUser;
}

async function updateUser(id, updatedUser) {
  const db = await connect();
  const user = await db.collection('User').findOne({ _id: new ObjectId(id) });
  if (updatedUser.email) {
    user.email = updatedUser.email;
  }
  if (updatedUser.password) {
    user.password = updatedUser.password;
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
  const result = await db
    .collection('User')
    .updateOne({ _id: new ObjectId(id) }, { $set: { ...updatedUser } });
  debugDb(result.insertedId);
  return result;
}

async function deleteUser(id) {
  const db = await connect();
  const user = await db.collection('User').findOne({ _id: new ObjectId(id) });
  if (!user) {
    return false;
  }
  const result = await db
    .collection('User')
    .deleteOne({ _id: new ObjectId(id) });
  return result;
}

async function updateMe(user){
  const db = await connect();
  const result = await db.collection('User').updateOne({ _id: user._id }, { $set: { ...user } });
  return result;
}

async function getCoasters() {
  const db = await connect();
  const coasters = await db.collection('Coasters').find({}).toArray();
  return coasters;
}

ping();

export {connect, ping};