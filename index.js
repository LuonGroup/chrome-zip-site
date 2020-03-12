const { URL } = require('url')
const fse = require('fs-extra') // v 5.0.0
const fs = require('fs') // v 5.0.0
const path = require('path')

// google-chrome --remote-debugging-port=9222
const CDP = require('chrome-remote-interface')

async function download (url) {
  let client, tab
  try {
    // connect to endpoint
    tab = await CDP.New()
    client = await CDP({ target: tab })
    // extract domains
    const { Network, Page } = client
    // setup handlers
    const requests = new Map()
    Network.requestWillBeSent(({ requestId, request }) => {
      console.log(`REQ [${requestId}] ${request.method} ${request.url}`)
      requests.set(requestId, request.url)
    })
    Network.loadingFinished(async ({ requestId }) => {
      if (requests.has(requestId)) {
        const url = new URL(requests.get(requestId))
        if (!~url.hostname.indexOf('.')) return

        let filePath = path.resolve(`./output-${url.hostname}/${url.pathname}`)
        if (!url.pathname || url.pathname[url.pathname.length - 1] == '/') {
          filePath = `${filePath}/index.html`
        }
        console.log('OUT: ', filePath)

        Network.getResponseBody({ requestId }).then(({ body, base64Encoded }) => {
          const opts = {}
          if (base64Encoded) {
            opts.encoding = 'base64'
          }
          fse.mkdirpSync(path.dirname(filePath))
          const stream = fs.createWriteStream(filePath)
          if (base64Encoded) {
            stream.setDefaultEncoding('base64')
          }
          stream.write(body)
          stream.end()
        }).catch(console.error)
      }
    })
    // enable events then start!
    await Network.enable()
    await Page.enable()
    await Page.navigate({ url })
    await Page.loadEventFired()
    console.log('Done.')
    // await CDP.Close({id: tab.id});
  } catch (err) {
    console.error(err)
  } finally {
    if (client) {
      // await client.close();
    }
  }
}

download(process.argv[2])
