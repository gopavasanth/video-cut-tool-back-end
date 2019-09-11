const request = require('request')
const OAuth = require('oauth-1.0a')
const crypto = require('crypto')
const { exec } = require('child_process')
const fs = require('fs');
const { out_location } = require('../routes/index');
var config = require('../config');

const oauth = OAuth({
  consumer: {
    key: config.consumer_key,
    secret: config.consumer_secret
  },
  signature_method: 'HMAC-SHA1',
  hash_function (baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64')
  },
})

const BASE_URL = 'https://commons.wikimedia.org/w/api.php';

function uploadFileToMediawiki(key, secret, file, options, callback) {

  if (!callback) {
    callback = () => { }
  }

  const token = {
    key,
    secret,
  }
  console.log('user token', token);
  return new Promise((resolve, reject) => {
    // fetch an update csrf token

    const requestData = {
      url: `${BASE_URL}?action=query&meta=tokens&type=csrf&format=json`,
      method: 'POST',
    }
    request({
      url: requestData.url,
      method: requestData.method,
      headers: oauth.toHeader(oauth.authorize(requestData, token)),
    }, (err, response, body) => {
      if (err) {
        reject(err)
        return callback(err)
      }
      const parsedBody = JSON.parse(body)
      console.log('parsed content', parsedBody)
      const csrfToken = parsedBody.query.tokens.csrftoken

      const requestData = {
        url: `${BASE_URL}?action=upload&ignorewarnings=true&format=json`,
        method: 'POST',
        formData: {
          file,
          token: csrfToken,
          ...options,
        },
      }
      // perform upload
      request({
        url: requestData.url,
        method: requestData.method,
        formData: requestData.formData,
        headers: oauth.toHeader(oauth.authorize(requestData, token)),
      }, (err, response, body) => {
        const parsedBody = JSON.parse(body)
        console.log('parsed body', parsedBody);
        if (parsedBody.error) {
          reject(parsedBody.error)
          return callback(parsedBody.error)
        }

        if (parsedBody.upload && parsedBody.upload.result.toLowerCase() === 'success') {
          resolve(parsedBody.upload)
          return callback(null, parsedBody.upload)
        } else {
          reject(parsedBody.upload)
          return callback(parsedBody.upload)
        }
      })
    })
  })
}

module.exports = {
  uploadFileToMediawiki,
}
