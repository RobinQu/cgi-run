var Buffer = require("buffer").Buffer,
    debug = require("debug")("cgi:stream"),
    TransformStream = require("stream").Transform,
    util = require("util"),
    statusExp = /^Status:\s*(\d{3}) (.*)$/i;



var CGIStream = function() {
  TransformStream.call(this);
  this.line = [];
  this.bodyBuffer = [];
  this.hasBody = false;
};

util.inherits(CGIStream, TransformStream);

CGIStream.prototype._transform =  function(chunk, enc, callback) {
  var i, c, s, m, idx, buf;
  if(this.hasBody) {
    this.bodyBuffer.push(chunk);
    this.push(chunk);
  } else {
    for(i=0;i<chunk.length;i++) {
      c = chunk[i];
      if(c === 0xA) {
        if(!this.line.length) {//meet body
          this.hasBody = true;
          buf = chunk.slice(i+1);
          this.bodyBuffer.push(buf);
          this.push(buf);
          console.log();
          break;
        }
        
        s = this.line.join("");
        this.line = [];
        if(!this.statusCode) {//guess status code
          m = statusExp.exec(s);
          if(m) {
            this.statusCode = parseInt(m[1], 10);
            this.reason = m[2];
            this.emit("status", this.statusCode, this.reason);
            continue;
          }
        }
        
        idx = s.indexOf(":");
        if(!this.hasBody) {//got header
          this.emit("header", s.slice(0, idx), s.slice(idx+1).trim());
        }
      } else if(c !== 0xD) {//store chars for parsing
        this.line.push(String.fromCharCode(c));
      }
    }
    
  }
  callback();
};


CGIStream.prototype._flush = function(callback) {
  debug("flush body");
  this.emit("body", Buffer.concat(this.bodyBuffer));
  callback();
};

module.exports = CGIStream;