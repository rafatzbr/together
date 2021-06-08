"use strict";
const axios = require("axios");

/**
 * 
 * @param {string} path server path. Eg. /api/something
 * @param {object} body Data to be sent in JSON format for POST requests
 * @param {string} target service target. Can have 3 formats: service_name (will be translated to service_name-backend), service_name-something or a full URI
 * @param {boolean} isBackend in case the service have a -backend in the end of the URL or not
 * @returns 
 */
const _getRequestOptions = (path, body, target, isBackend) => {
  let options = {
    protocol: 'http',
    host: "localhost",
    timeout: 0,
    method: "GET",
  };
  if (process.env.VCAP_APPLICATION || target.indexOf("http") === 0) {
    if (target.indexOf("http") === 0) {
      options.url = target;
    } else {
      let envApp = JSON.parse(process.env.VCAP_APPLICATION),
        uri = envApp.uris[0],
        domain = uri.substr(uri.indexOf(".")),
        environment = uri.substr(0, uri.indexOf("-"));
      options.protocol = "https";
      if (target.indexOf("-") < 0 && isBackend) target += "-backend";
      options.host = `${environment}-${target}${domain}`;
    }
  } else {
    if (!process.env.SERVICES_PORT_MAPPING) throw new Error('Missing SERVICES_PORT_MAPPING variable')

    const portMapping = (typeof process.env.SERVICES_PORT_MAPPING === 'string' ? JSON.parse(process.env.SERVICES_PORT_MAPPING) : process.env.SERVICES_PORT_MAPPING);
    
    // switch (target) {
    //   case "swarm":
    //     port = 3002;
    //     break;
    //   case "pulse":
    //     port = 3006;
    //     break;
    //   // recommender
    //   default:
    //     port = 3000;
    // }
    options.port = portMapping[target];
  }
  options.path = path || "/";
  if (!options.url) {
    options.url = options.protocol + "://" + options.host + (options.port ? `:${options.port}` : '') + options.path;
  }
  
  if (body) {
    options.method = "POST";
    options.json = body;
  }
//   console.log(options);
  return options;
};

/**
 * Query against another SCP service in the same subaccount
 *
 * @param {string} accessToken xsuaa token
 * @param {string} path server path. Eg. /api/something
 * @param {Object} content Data to be sent in JSON format for POST requests
 * @param {string} target service target. Can have 3 formats: service_name (will be translated to service_name-backend), service_name-something or a full URI
 * @param {Logger} logger xs2/logger object 
 * @param {boolean} isBackend in case the service have a -backend in the end of the URL or not
 */
module.exports = async (accessToken, path, content, target, logger, isBackend = true) => {
  if (!target) target = "recommender";
  let options = _getRequestOptions(path, content, target, isBackend);

  let headers = {};
  
  if (typeof accessToken === 'string') {
    headers.authorization = 'bearer ' + accessToken;
  } else {
      if (!accessToken.header) accessToken.header = 'authorization';
      headers[accessToken.header] = `${accessToken.type} ${accessToken.token}`;
  }

  options.headers = headers;
  if (logger) logger.info("Querying service " + target);
  
  options.responseType = 'json';
  options.timeout = 100000;
  
  const req = await axios(options);
  return req.data;
};