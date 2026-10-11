const EventEmitter = require('events');

const events = new EventEmitter(); // one shared instance for the whole app

const EVENTS = {
  APPLICATION_CREATED: 'application:created',
  APPLICATION_STATUS_CHANGED: 'application:statusChanged',
};

module.exports = { events, EVENTS };