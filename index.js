var DecodeStream = require('./decode-stream')
var FrameStream = require('./frame-stream')

module.exports = {
  createDecodeStream: DecodeStream,
  createFrameStream: FrameStream
}
