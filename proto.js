var fs = require('fs')
var protobuf = require('protocol-buffers')
var proto = protobuf(fs.readFileSync(__dirname + '/message.proto'))
proto.RECORD_SEPARATOR = 0x1e
proto.UNIT_SEPARATOR = 0x1f

module.exports = proto
