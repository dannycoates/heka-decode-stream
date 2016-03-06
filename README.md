# heka-stream

Stream Heka's frame delimited protobuf messages

## Example

```js
var fs = require('fs')
var zlib = require('zlib')
var HekaStream = require('heka-stream')

fs.createReadStream(__dirname + '/data.gz')
  .pipe(zlib.createGunzip())
  .pipe(HekaStream.createDecodeStream())
  .on('data', function (message) {
    console.log(message.type)
    console.log(message.fields)
  })
```
