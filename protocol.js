var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter
var proto = require('./proto')
var fillBuffer = require('./fill-buffer')

function InitState() {
  this.rest = Buffer(0)
}

InitState.prototype.next = function (buf) {
  for (var i = 0; i < buf.length; i++) {
    if (buf[i] === proto.RECORD_SEPARATOR) {
      return new FrameState(buf.slice(i))
    }
  }
  return this
}

function FrameState(buf) {
  this.buffer = new Buffer(2)
  this.index = 0
  this.rest = buf
}

FrameState.prototype.next = function (buf) {
  if (fillBuffer(this, buf)) {
    if (this.buffer[0] !== proto.RECORD_SEPARATOR) {
      return new InitState()
    }
    // The headerState.size = sizeByte + unit separator byte
    return new HeaderState(this.buffer.readUInt8(1) + 1, this)
  }
  return this
}

function HeaderState(size, frame) {
  this.buffer = new Buffer(size)
  this.index = 0
  this.rest = frame.rest
  this.frame = frame
}

HeaderState.prototype.next = function (buf) {
  if (fillBuffer(this, buf)) {
    if(this.buffer[this.buffer.length - 1] !== proto.UNIT_SEPARATOR) {
      return new InitState()
    }
    // this.buffer includes a separator byte at the end. exclude it
    var header = proto.Header.decode(this.buffer.slice(0, this.buffer.length - 1))
    return new MessageState(header.message_length, this)
  }
  return this
}

function MessageState(size, header) {
  this.buffer = new Buffer(size)
  this.index = 0
  this.rest = header.rest
  this.header = header
}

MessageState.prototype.next = function (buf) {
  if (fillBuffer(this, buf)) {
    return new EOMState(this)
  }
  return this
}

MessageState.prototype.toFrameBuffer = function () {
  return Buffer.concat([
    this.header.frame.buffer,
    this.header.buffer,
    this.buffer])
}

MessageState.prototype.toObject = function () {
  return proto.Message.decode(this.buffer)
}

function EOMState(message) {
  this.message = message
  this.rest = message.rest
}

EOMState.prototype.next = function (buf) {
  return new FrameState(buf)
}

function Protocol() {
  EventEmitter.call(this)
  this.state = new InitState()
}
inherits(Protocol, EventEmitter)

Protocol.prototype.append = function (buf) {
  while (buf.length > 0) {
    this.state = this.state.next(buf)
    buf = this.state.rest
    if (this.state.message) {
      this.emit('message', this.state.message)
    }
  }
}

module.exports = Protocol
