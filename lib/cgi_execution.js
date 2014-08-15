var spawn = require("cross-spawn"),
    Buffer = require("buffer").Buffer,
    debug = require("debug")("cgi:exec");

var CGIExecution = function(cgi, options) {
  options = options || {};
  this.cgi = cgi;
  this.stderr = options.stderr;
};

CGIExecution.prototype.run = function(env, stdin, cb) {
  var self = this, done, error, child, 
      resp = {
        headers:{}
      };
  
  if(typeof stdin === "function") {
    cb = stdin;
    stdin = null;
  }
  
  done = function() {
    if (resp.exit === undefined) {
      return;
    }
    if (resp.exit && !resp.body) {
      error(500, self.cgi + " exited with code " + resp.exit);
    } else {
      resp.body = Buffer.concat(buffer);
      cb(null, resp);
    }
  };

  error = function(code, reason) {
    debug("error %s", code);
    if(code instanceof Error) {
      cb(code);
    } else {
      var ex = new Error(reason);
      ex.status = code;
      cb(ex);
    }
  };
  
  debug("spawn %s", self.cgi);
  child = spawn(self.cgi, [], {
    "env": env
  }).on("exit", function(code) {
    resp.exit = code;
    done();
  });
  
  
  var line = [], buffer = [], body, statusExp = /^Status:\s*(\d{3}) (.*)$/i;
  child.stdout.on("end", done).on("data", function(buf) {
    var i, c, s, m, idx;
    if(body) {
      return buffer.push(buf);
    }
    for(i=0;i<buf.length;i++) {
      c = buf[i];
      if (c === 0xA) {
        if(!line.length) {
          body = true;
          resp.status = 200;
          buffer.push(buf.slice(i + 1));
          return;
        }

        s = line.join("");
        line = [];
        if(!resp.status) {
          m = statusExp.exec(s);
          if(m) {
            resp.status = m[1];
            resp.reason = m[2];
            continue;
          }
        }

        idx = s.indexOf(":");
        if(!body) {
          resp.headers[s.slice(0, idx)] = s.slice(idx + 1).trim();
        }
      } else if(c !== 0xD) {
        line.push(String.fromCharCode(c));
      }
    }
  });
  
  if(stdin) {
    stdin.pipe(child.stdin);
  }
  if(self.stderr) {
    child.stderr.pipe(self.stderr);
  }
};

module.exports = CGIExecution;