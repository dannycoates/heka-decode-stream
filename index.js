var fs = require('fs')
var inherits = require('util').inherits
var Transform = require('readable-stream').Transform
var protobuf = require('protocol-buffers')
var proto = protobuf(fs.readFileSync(__dirname + '/message.proto'))

const RECORD_SEPARATOR = 0x1e
const UNIT_SEPARATOR = 0x1f
const HIGH_WATER_MARK = 1024 * 16

function fillBuffer(state, buf) {
	var bytesLeft = state.buffer.length - state.index
	var bytesCopied = Math.min(buf.length, bytesLeft)
	buf.copy(state.buffer, state.index, 0, bytesCopied)
	state.rest = buf.slice(bytesCopied)
	state.index += bytesCopied
	return state.index === state.buffer.length
}

function parseField(f) {
  var value = []
  switch (f.value_type) {
    case 0: // string
      value = f.value_string
      break;
    case 1: // bytes
      value = f.value_bytes
      break;
    case 2: // integer
      value = f.value_integer
      break;
    case 3: // double
      value = f.value_double
      break;
    case 4: // bool
      value =  f.value_bool
      break;
  }
  if (value.length > 1) {
    return value
  }
  return value[0]
}

function defaultExtractor(m) {
  var result = {
    uuid: m.uuid.toString('hex'),
    timestamp: Math.floor(m.timestamp / 1000000),
    type: m.type,
    logger: m.logger,
    severity: m.severity,
    payload: m.payload,
    env_version: m.env_version,
    pid: m.pid,
    hostname: m.hostname,
    fields: {}
  }
  for (var i = 0; i < m.fields.length; i++) {
    var f = m.fields[i]
    result.fields[f.name] = parseField(f)
  }
  return result
}

function InitState() {
  this.rest = Buffer(0)
}

InitState.prototype.next = function (buf) {
  for (var i = 0; i < buf.length; i++) {
    if (buf[i] === RECORD_SEPARATOR) {
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
    if (this.buffer[0] !== RECORD_SEPARATOR) {
      return new InitState()
    }
    // The headerState.size = sizeByte + unit separator byte
    return new HeaderState(this.buffer.readUInt8(1) + 1, this.rest)
  }
  return this
}

function HeaderState(size, buf) {
  this.buffer = new Buffer(size)
  this.index = 0
  this.rest = buf
}

HeaderState.prototype.next = function (buf) {
  if (fillBuffer(this, buf)) {
    if(this.buffer[this.buffer.length - 1] !== UNIT_SEPARATOR) {
      return new InitState()
    }
    // this.buffer includes a separator byte at the end. exclude it
    var header = proto.Header.decode(this.buffer.slice(0, this.buffer.length - 1))
    return new MessageState(header.message_length, this.rest)
  }
  return this
}

function MessageState(size, buf) {
  this.buffer = new Buffer(size)
  this.index = 0
  this.rest = buf
}

MessageState.prototype.next = function (buf) {
  if (fillBuffer(this, buf)) {
    return new ObjectState(proto.Message.decode(this.buffer), this.rest)
  }
  return this
}

function ObjectState(message, buf) {
  this.message = message
  this.rest = buf
}

ObjectState.prototype.next = function (buf) {
  return new FrameState(buf)
}

function Protocol(options) {
  this.state = new InitState()
  this.extractor = options.extractor || defaultExtractor
  this.filter = options.filter || function () { return true }
}

Protocol.prototype.append = function (buf, stream) {
  while (buf.length > 0) {
    this.state = this.state.next(buf)
    buf = this.state.rest
    if (this.state.message && this.filter(this.state.message)) {
      stream.push(this.extractor(this.state.message))
    }
  }
}

function HekaDecodeStream(options) {
  options = options || {}
  if (!(this instanceof HekaDecodeStream)) {
    return new HekaDecodeStream(options)
  }
  Transform.call(
    this,
    {
      readableObjectMode : true,
      highWaterMark: options.highWaterMark || HIGH_WATER_MARK
    }
  )
  this._destroyed = false
  this._protocol = new Protocol(options)
}
inherits(HekaDecodeStream, Transform)

HekaDecodeStream.prototype.destroy = function(err) {
  if (this._destroyed) { return }
  this._destroyed = true

  process.nextTick(
    function() {
      if (err) { this.emit('error', err) }
      this.emit('close')
    }.bind(this)
  )
}

HekaDecodeStream.prototype._transform = function (chunk, encoding, cb) {
  if (Buffer.isBuffer(chunk)) {
    this._protocol.append(chunk, this)
  }
  cb()
}

module.exports = HekaDecodeStream
