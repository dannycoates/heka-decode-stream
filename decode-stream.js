var inherits = require('util').inherits
var Transform = require('readable-stream').Transform
var Protocol = require('./protocol')

const HIGH_WATER_MARK = 1024 * 16

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
  this._protocol = new Protocol()
  this._protocol.on('message', pushData.bind(this))
  this.filter = options.filter || all
  this.extractor = options.extractor || defaultExtractor

}
inherits(HekaDecodeStream, Transform)

HekaDecodeStream.parseField = parseField
HekaDecodeStream.defaultExtractor = defaultExtractor

function all() { return true }

function pushData(message) {
  var obj = message.toObject()
  if (this.filter(obj)) {
    this.push(this.extractor(obj))
  }
}

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
