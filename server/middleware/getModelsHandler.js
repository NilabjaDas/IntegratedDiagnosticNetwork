const mongoose = require('mongoose');

const models = {};

const getModel = (db, modelName, schema) => {
  if (!models[db.name]) {
    models[db.name] = {};
  }
  if (!models[db.name][modelName]) {
    models[db.name][modelName] = db.model(modelName, schema);
  }
  return models[db.name][modelName];
};

module.exports = getModel;
