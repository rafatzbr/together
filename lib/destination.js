'use strict';
const xsenv = require("@sap/xsenv");
const axios = require('axios');
const https = require('https');

/**
 * Get the destination service
 */
const getService = () => {
  return xsenv.getServices({
    destination: {
      tag: "destination",
    },
  }).destination;
};

/**
 * Retrieve the access token to the destination service
 * @param {Object} destinationService
 */
const getToken = async (destinationService) => {
  if (!destinationService) destinationService = getService();

  let options = {
    method: "POST",
    url: `${destinationService.url}/oauth/token?grant_type=client_credentials&client_id=${destinationService.clientid}`,
    responseType: 'json',
    headers: {
      Authorization:
        " Basic " +
        Buffer.from(
          `${destinationService.clientid}:${destinationService.clientsecret}`
        ).toString("base64"),
    },
  };

  const request = await axios(options);

  return request.data.access_token;
};

/**
 * Gets the information from the destination service based on destinationName
 * @destinationName {string} Name of the destination
 * @options {object} Options to get the data
 * userToken: The JWT token of the current logged user
 * source: global or space, defaults to global
 *
 * @returns {Object} Destination Parameters
 */
const getData = async (destinationName, options = {}, destinationService, destinationToken) => {
    if (!destinationService) destinationService = getService();
    if (!destinationToken) destinationToken = await getToken(destinationService);

    let destinationSource = (options.source === 'space' ? 'destinations' : 'subaccountDestinations');

    let connectionOptions = {
      responseType: 'json',
      url: `${destinationService.uri}/destination-configuration/v1/${destinationSource}/${destinationName}`,
      headers: {
          Authorization: "Bearer " + destinationToken,
      }
    };

    if (options.userToken) {
      connectionOptions.headers["X-user-token"] = options.userToken;
    }
    // console.log('here', connectionOptions);

    const request = await axios(connectionOptions).catch(err => console.log(err, connectionOptions));
    let destinationData = request.data;

    try {
        if (typeof destinationData === "string") destinationData = JSON.parse(destinationData);
    } catch (JSONError) {
        // console.log(destinationData);
    }
    
    let destinationConfiguration = {};

    if (options.source === 'space') {
      destinationConfiguration = {
        ...destinationData.destinationConfiguration,
        headers: {}
      };
      if (destinationData.authTokens.length > 0) {
        destinationConfiguration.headers[destinationData.authTokens[0].http_header.key] = destinationData.authTokens[0].http_header.value;
      }
    } else {
      destinationConfiguration = {
        ...destinationData,
        headers: {}
      };
    }

    if (destinationConfiguration.Authentication === 'BasicAuthentication') {
      destinationConfiguration.headers.Authorization = " Basic " + Buffer.from(`${destinationConfiguration.User}:${destinationConfiguration.Password}`).toString("base64");
    }

    destinationData = destinationConfiguration;

    return destinationData;
}

/**
 * Run requests against a destination in the SPACE
 * 
 * @param {Object} options
 * Properties
 * MANDATORY
 * destination: Name of the destination you want to query
 *
 * OPTIONALS
 * method: POST or GET - defaults to GET
 * path: Path in the destination to be query
 * userToken: The JWT token of the current logged user
 * data: POST data to be sent as JSON
 * source: global or space, defaults to global
 * destinationService
 * destinationToken,
 * proxy: Connectivity Proxy Object
 *
 */
const query = async (options) => {
    let data = {};
    if (!options.source) options.source = 'global';

    const destinationData = await getData(options.destination, {userToken: options.userToken, source: options.source});
    // data = await request(destinationData);
    if (destinationData.URL.substr(-1) === '/' && options.path.substr(0, 1) === '/') options.path = options.path.substr(1);

    if (typeof destinationData === "string") destinationData = JSON.parse(destinationData);
    let connectionOptions = {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      url: `${destinationData.URL}${options.path}`,
      method: options.method || "GET",
      // json: true,
      headers: {
        ...options.headers,
        ...destinationData.headers
      }
    };

    if (options.proxy) {
      connectionOptions.proxy = `http://${options.proxy.proxyHost}:${options.proxy.proxyPort}`;
      connectionOptions.headers['Proxy-Authorization'] = `Bearer ${options.proxy.token}`;
    } else {
      if (connectionOptions.url.indexOf(':443') >= 0 && destinationData.URL.indexOf('http://') >= 0) {
        connectionOptions.url = connectionOptions.url.split('http://').join('https://').split(':443').join('');
      }
    }

    if (options.data) connectionOptions.data = options.data;
    // console.log(connectionOptions);
    try {
      let req = await axios(connectionOptions);
      data = req.data;
    } catch (err) {
      console.log(err);
    } finally {
      return data;
    }
};

module.exports = {
    getService,
    getToken,
    getData,
    query
};