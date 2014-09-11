var CGIExecution = require("./cgi_execution"),
    assert = require("assert"),
    path = require("path"),
    debug = require("debug")("cgi:runner"),
    url = require("url");

var Runner = function(options) {
  options = options || {};
  assert(options.root, "should provide document root");
  //bin path
  options.cgi = options.cgi || "php-cgi";
  options.extension = options.extension || ".php";
  debug("using cgi proc %s for %s", options.cgi, options.extension);
  
  this.options = options;
  
  this.exec = new CGIExecution(options.cgi, {
    stderr: options.stderr,
    headers: options.headers
  });
};

Runner.prototype._parseIP = function(req) {
  if(req.headers["X-Client-IP"]) {
    return req.headers["X-Client-IP"];
  }
  var forwardStr = req.headers["X-Forwarded-For"];
  if(forwardStr) {
    return forwardStr.split(",")[0].trim();
  }
  return req.connection.remoteAddress;
};

Runner.prototype._env = function(req, scriptPath) {
  var host = (req.headers.host || "").split(":"),
      env;
  env = {
    SERVER_ROOT: this.options.root,
    DOCUMENT_ROOT: this.options.root,
    SERVER_NAME: host[0],
    SERVER_PORT: host[1] || 80,
    HTTPS: req.connection.encrypted ? "On" : "Off",
    REDIRECT_STATUS: 200,

    SCRIPT_NAME: this.options.script,
    REQUEST_URI: req.url,
    SCRIPT_FILENAME: scriptPath,
    PATH_TRANSLATED: scriptPath,
    REQUEST_METHOD: req.method,
    QUERY_STRING: url.parse(req.url).search || "",
    GATEWAY_INTERFACE: "CGI/1.1",
    SERVER_PROTOCOL: "HTTP/1.1",
    PATH: process.env.PATH,
    "__proto__": this.options.env || {},
    REMOTE_ADDR: this._parseIP(req)
  };
  
  // expose request headers
  Object.keys(req.headers).forEach(function(header) {
    var name = "HTTP_" + header.toUpperCase().replace(/-/g, "_");
    env[name] = req.headers[header];
  });
  
  if (req.headers["content-length"]) {
      env.CONTENT_LENGTH = req.headers["content-length"];
  }

  if (req.headers["content-type"]) {
      env.CONTENT_TYPE = req.headers["content-type"];
  }
  
  return env;
};


Runner.prototype.run = function(req, callback) {
  
  var scriptPath, env;
  //Let's guess which script to execute with cgi bin 
  if(this.options.script) {// `options.script` is optional. However, if it's given, all cgi requests will be executed against this gateway script
    scriptPath = path.normalize(path.join(this.options.root, this.options.script));
  } else {
    scriptPath = path.normalize(path.join(this.options.root, ctx.path));
    if(fs.existsSync(scriptPath)) {
      if(fs.statsSync(scriptPath).isDirectory()) {//it's a dir
        scriptPath = path.join(scriptPath, "index" + this.options.extension);
      }
    } else {//if the gussed path is not valid and `options.script` is not given, we should give up
      debug("no target script; skip run");
      return callback(null, false);
    }
  }
  
  debug("%s %s -> %s", req.method, req.url, scriptPath);
  env = this._env(req, scriptPath);
  
  //will throw if cgi returns non-zero
  this.exec.run(env, req, callback);
  
};

module.exports = Runner;