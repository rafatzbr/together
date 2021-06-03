"use strict";
const xsenv = require("@sap/xsenv");
const axios = require('axios');

/**
 * Returns the connectivity service
 */
const getService = () => {
  return xsenv.getServices({
    connectivity: {
      tag: "connectivity",
    }
  }).connectivity;
};

/**
 * Returns the client token to the connectivity service
 * 
 * @param {*} connectivity Connectivity service
 * @returns String
 */

const getClientToken = async (connectivity = getService()) => {
  let options = {
    url: `${connectivity.url}/oauth/token?grant_type=client_credentials&client_id=${connectivity.clientid}`,
    responseType: 'json',
    headers: {
      Authorization: "Basic " + Buffer.from(connectivity.clientid + ':' + connectivity.clientsecret).toString('base64')
    },
  };

  let data = await axios(options);
  return data.data.access_token;
};

/**
 * Gets the refresh and access token from the connectivity service
 *
 */
const getTokens = async (userToken, connectivity = getService()) => {
  let tokens = {
    refresh: null,
    access: null,
  };

  let options = {
    method: "POST",
    url: `${connectivity.url}/oauth/token?grant_type=user_token&response_type=token&client_id=${connectivity.clientid}`,
    responseType: 'json',
    headers: {
      Authorization: "Bearer " + userToken,
    },
  };
  let data = await axios(options);
  tokens.refresh = data.data.refresh_token;

  options = {
    url: `${connectivity.url}/oauth/token?grant_type=refresh_token&refresh_token=${tokens.refresh}`,
    responseType: 'json',
    headers: {
      Authorization:
        " Basic " +
        Buffer.from(
          `${connectivity.clientid}:${connectivity.clientsecret}`
        ).toString("base64"),
    },
  };
  data = await axios(options);
  tokens.access = data.data.access_token;

  return tokens;
};

/**
 *
 */
const getData = async (connectivity = getService()) => {
  let connData = {};

  if (process.env.VCAP_APPLICATION) {
    const options = {
      url:
        connectivity.url +
        "/oauth/token?grant_type=client_credentials&response_type=token",
      responseType: 'json',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " +
        Buffer.from(
          `${connectivity.clientid}:${connectivity.clientsecret}`
        ).toString('base64')
      }
    };

    let res = await axios(options),
      json = res.data;
    if (typeof json === 'string')
      json = JSON.parse(json);

    connData = {
      token: json.access_token,
      proxyHost: connectivity.onpremise_proxy_host,
      proxyPort: connectivity.onpremise_proxy_port,
    };
  }

  return connData;
};

module.exports = {
  getService,
  getTokens,
  getData,
  getClientToken
};
