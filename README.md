# heka-decode-stream

Decodes Heka's frame delimited protobuf messages into js objects

## Example

```js
var fs = require('fs')
var zlib = require('zlib')
var HekaDecodeStream = require('heka-decode-stream')

fs.createReadStream(__dirname + '/data.gz')
  .pipe(zlib.createGunzip())
  .pipe(HekaDecodeStream())
  .on('data', function (message) {
    console.log(message.type)
    console.log(message.fields)
  })
```
