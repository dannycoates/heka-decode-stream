var inherits = require('util').inherits
var Transform = require('readable-stream').Transform
var Protocol = require('./protocol')

const HIGH_WATER_MARK = 1024 * 16

function HekaFrameStream(options) {
  options = options || {}
  if (!(this instanceof HekaFrameStream)) {
    return new HekaFrameStream(options)
  }
  Transform.call(
    this,
    {
      highWaterMark: options.highWaterMark || HIGH_WATER_MARK
    }
  )
  this._destroyed = false
  this._protocol = new Protocol()
  this._protocol.on('message', pushData.bind(this))
}
inherits(HekaFrameStream, Transform)

function pushData(message) {
  this.push(message.toFrameBuffer())
}

HekaFrameStream.prototype.destroy = function(err) {
  if (this._destroyed) { return }
  this._destroyed = true

  process.nextTick(
    function() {
      if (err) { this.emit('error', err) }
      this.emit('close')
    }.bind(this)
  )
}

HekaFrameStream.prototype._transform = function (chunk, encoding, cb) {
  if (Buffer.isBuffer(chunk)) {
    this._protocol.append(chunk, this)
  }
  cb()
}

module.exports = HekaFrameStream
